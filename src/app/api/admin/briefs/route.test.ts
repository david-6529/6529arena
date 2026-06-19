import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createWaveBriefDraft } from "@/lib/data/wave-briefs";
import { consumeRateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/observability/events";

vi.mock("@/lib/data/wave-briefs", () => ({
  createWaveBriefDraft: vi.fn(),
  listWaveBriefs: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
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

function createRequest(body: unknown) {
  delete process.env.ADMIN_API_KEY;
  process.env.RATE_LIMIT_SALT = "test-salt";

  return new Request("https://arena.example/api/admin/briefs", {
    method: "POST",
    headers: {
      "user-agent": "vitest",
      "x-forwarded-for": "203.0.113.1",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/briefs", () => {
  it("blocks generation when the summary rate-limit env is invalid", async () => {
    process.env.WAVE_BRIEF_RATE_LIMIT_PER_HOUR = "0";

    const response = await POST(
      createRequest({
        waveId: "wave-1",
        requestText: "Create a summary.",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Wave summary generation is disabled because WAVE_BRIEF_RATE_LIMIT_PER_HOUR must be a positive integer.",
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(createWaveBriefDraft).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.rate_limit_config_invalid",
        severity: "error",
        entityType: "wave",
        entityId: "wave-1",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          envName: "WAVE_BRIEF_RATE_LIMIT_PER_HOUR",
        }),
      }),
    );
  });

  it("blocks generation when the summary rate-limit env is fractional", async () => {
    process.env.WAVE_BRIEF_RATE_LIMIT_PER_HOUR = "0.5";

    const response = await POST(
      createRequest({
        waveId: "wave-1",
        requestText: "Create a summary.",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Wave summary generation is disabled because WAVE_BRIEF_RATE_LIMIT_PER_HOUR must be a positive integer.",
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(createWaveBriefDraft).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.rate_limit_config_invalid",
        severity: "error",
        entityType: "wave",
        entityId: "wave-1",
        actor: "operator",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          envName: "WAVE_BRIEF_RATE_LIMIT_PER_HOUR",
        }),
      }),
    );
  });

  it("blocks generation when the summary cost-cap env is invalid before consuming rate limit", async () => {
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = "0";

    const response = await POST(
      createRequest({
        waveId: "wave-1",
        requestText: "Create a summary.",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Wave summary generation is disabled because MAX_WAVE_BRIEF_ESTIMATED_COST_USD must be a positive number.",
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(createWaveBriefDraft).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.cost_cap_config_invalid",
        severity: "error",
        entityType: "wave",
        entityId: "wave-1",
        actor: "operator",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          envName: "MAX_WAVE_BRIEF_ESTIMATED_COST_USD",
        }),
      }),
    );
  });

  it("blocks generation when the selected provider key is missing before consuming rate limit", async () => {
    process.env.WAVE_BRIEF_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;

    const response = await POST(
      createRequest({
        waveId: "wave-1",
        requestText: "Create a summary.",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Wave summary generation is disabled because OPENAI_API_KEY is not configured.",
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(createWaveBriefDraft).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.provider_config_missing",
        severity: "error",
        entityType: "wave",
        entityId: "wave-1",
        actor: "operator",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          provider: "openai",
          modelName: "gpt-4.1-mini",
          keyName: "OPENAI_API_KEY",
        }),
      }),
    );
  });

  it("rate-limits summary generation before creating a draft", async () => {
    process.env.WAVE_BRIEF_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    const resetAt = new Date("2026-06-18T12:00:00.000Z");
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt,
    });

    const response = await POST(
      createRequest({
        waveId: "wave-1",
        requestText: "Create a summary.",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "Wave summary generation rate limit exceeded.",
      resetAt: resetAt.toISOString(),
    });
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(response.headers.get("x-ratelimit-reset")).toBe(resetAt.toISOString());
    expect(createWaveBriefDraft).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.rate_limit_rejected",
        severity: "warn",
        entityType: "wave",
        entityId: "wave-1",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          resetAt: resetAt.toISOString(),
        }),
      }),
    );
  });

  it("creates a draft and returns remaining rate-limit headers when allowed", async () => {
    process.env.WAVE_BRIEF_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.WAVE_BRIEF_RATE_LIMIT_PER_HOUR = "25";
    const resetAt = new Date("2026-06-18T12:00:00.000Z");
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt,
    });
    vi.mocked(createWaveBriefDraft).mockResolvedValue({
      id: "brief-1",
      waveId: "wave-1",
    } as never);

    const response = await POST(
      createRequest({
        waveId: "wave-1",
        requestText: "Create a summary.",
        maxMessages: 100,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      brief: {
        id: "brief-1",
        waveId: "wave-1",
      },
      remaining: 9,
    });
    expect(response.headers.get("x-ratelimit-remaining")).toBe("9");
    expect(response.headers.get("x-ratelimit-reset")).toBe(resetAt.toISOString());
    expect(consumeRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "admin_wave_brief",
        limit: 25,
        windowMs: 60 * 60 * 1000,
      }),
    );
    expect(createWaveBriefDraft).toHaveBeenCalledWith({
      waveId: "wave-1",
      requestText: "Create a summary.",
      maxMessages: 100,
    });
  });

  it("passes related waves through to draft creation", async () => {
    process.env.WAVE_BRIEF_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    const resetAt = new Date("2026-06-18T12:00:00.000Z");
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 8,
      resetAt,
    });
    vi.mocked(createWaveBriefDraft).mockResolvedValue({
      id: "brief-2",
      waveId: "wave-parent",
    } as never);

    const response = await POST(
      createRequest({
        waveId: "wave-parent",
        requestText: "Summarize the PR pipeline.",
        relatedWaves: [
          {
            waveId: "https://6529.io/waves/wave-firehose",
            label: "Raw PR feed",
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    expect(createWaveBriefDraft).toHaveBeenCalledWith({
      waveId: "wave-parent",
      requestText: "Summarize the PR pipeline.",
      relatedWaves: [
        {
          waveId: "https://6529.io/waves/wave-firehose",
          label: "Raw PR feed",
        },
      ],
    });
  });
});
