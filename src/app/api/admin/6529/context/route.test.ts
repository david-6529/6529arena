import { afterEach, describe, expect, it, vi } from "vitest";
import { previewWaveContext } from "@/lib/6529/wave-context";
import { logEvent } from "@/lib/observability/events";
import { POST } from "./route";

vi.mock("@/lib/6529/wave-context", () => ({
  previewWaveContext: vi.fn(),
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

  return new Request("https://arena.example/api/admin/6529/context", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/6529/context", () => {
  it("previews a parent wave with related waves", async () => {
    vi.mocked(previewWaveContext).mockResolvedValue({
      waveId: "wave-parent",
      dropCount: 2,
      fromDropId: "drop-1",
      toDropId: "drop-2",
      context: {
        from: "2026-06-18T00:00:00.000Z",
        to: "2026-06-18T12:00:00.000Z",
        maxMessages: 50,
        maxMessagesPerWave: 25,
        searchedMessages: 2,
        explicitWindow: true,
        sources: [
          {
            waveId: "wave-parent",
            label: "Primary wave",
            primary: true,
            name: "Follow The Repo",
            dropCount: 1,
            searchedMessages: 1,
          },
          {
            waveId: "wave-firehose",
            label: "Raw PR feed",
            primary: false,
            name: "PR Firehose",
            dropCount: 1,
            searchedMessages: 1,
          },
        ],
      },
      sampleDrops: [],
    } as never);

    const response = await POST(
      createRequest({
        waveId: "wave-parent",
        maxMessages: 50,
        contextFrom: "2026-06-18T00:00:00.000Z",
        contextTo: "2026-06-18T12:00:00.000Z",
        relatedWaves: [
          {
            waveId: "https://6529.io/waves/wave-firehose",
            label: "Raw PR feed",
          },
        ],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.preview.dropCount).toBe(2);
    expect(previewWaveContext).toHaveBeenCalledWith({
      waveId: "wave-parent",
      maxMessages: 50,
      contextFrom: "2026-06-18T00:00:00.000Z",
      contextTo: "2026-06-18T12:00:00.000Z",
      relatedWaves: [
        {
          waveId: "https://6529.io/waves/wave-firehose",
          label: "Raw PR feed",
        },
      ],
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "admin.wave_context_previewed",
        metadata: expect.objectContaining({
          dropCount: 2,
          maxMessages: 50,
          relatedWaveCount: 1,
        }),
      }),
    );
  });
});
