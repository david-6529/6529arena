import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { searchWaves } from "@/lib/6529/wave-search";

vi.mock("@/lib/6529/wave-search", () => ({
  searchWaves: vi.fn(),
}));

vi.mock("@/lib/observability/events", () => ({
  logEvent: vi.fn(),
}));

vi.mock("@/lib/observability/telemetry", () => ({
  captureTelemetryException: vi.fn(),
}));

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

function searchRequest(query: string, headers?: HeadersInit) {
  return new Request(`https://arena.example/api/admin/6529/waves/search${query}`, {
    headers,
  });
}

describe("GET /api/admin/6529/waves/search", () => {
  it("returns no waves for short queries without searching", async () => {
    delete process.env.ADMIN_API_KEY;

    const response = await GET(searchRequest("?q=w"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ waves: [] });
    expect(searchWaves).not.toHaveBeenCalled();
  });

  it("searches waves with a bounded limit", async () => {
    delete process.env.ADMIN_API_KEY;
    vi.mocked(searchWaves).mockResolvedValue([
      {
        id: "wave-1",
        name: "Meme Grants",
        description: null,
        source: "history",
      },
    ]);

    const response = await GET(searchRequest("?q=meme&limit=50"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(searchWaves).toHaveBeenCalledWith("meme", { limit: 8 });
    expect(body).toEqual({
      waves: [
        {
          id: "wave-1",
          name: "Meme Grants",
          description: null,
          source: "history",
        },
      ],
    });
  });

  it("requires operator auth when ADMIN_API_KEY is configured", async () => {
    process.env.ADMIN_API_KEY = "secret";

    const response = await GET(searchRequest("?q=meme"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(searchWaves).not.toHaveBeenCalled();
  });
});
