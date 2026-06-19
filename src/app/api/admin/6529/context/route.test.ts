import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWaveContextPreview, fetchWaveContext } from "@/lib/6529/wave-context";
import { estimateWaveBriefDraftCost } from "@/lib/briefs/runBrief";
import { logEvent } from "@/lib/observability/events";
import { POST } from "./route";

vi.mock("@/lib/6529/wave-context", () => ({
  buildWaveContextPreview: vi.fn(),
  fetchWaveContext: vi.fn(),
}));

vi.mock("@/lib/briefs/runBrief", () => ({
  estimateWaveBriefDraftCost: vi.fn(),
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
    vi.mocked(fetchWaveContext).mockResolvedValue({
      wave: { id: "wave-parent" },
      relatedWaves: [],
      drops: [{ id: "drop-1", content: "Parent drop" }],
      context: {
        from: null,
        to: null,
        mode: "all",
        includeAllHistory: true,
        maxMessages: 50,
        maxMessagesPerWave: 25,
        searchedMessages: 2,
        hitCap: false,
        explicitWindow: false,
        sources: [],
      },
    } as never);
    vi.mocked(buildWaveContextPreview).mockReturnValue({
      waveId: "wave-parent",
      dropCount: 2,
      fromDropId: "drop-1",
      toDropId: "drop-2",
      context: {
        from: null,
        to: null,
        mode: "all",
        includeAllHistory: true,
        maxMessages: 50,
        maxMessagesPerWave: 25,
        searchedMessages: 2,
        hitCap: false,
        explicitWindow: false,
        sources: [
          {
            waveId: "wave-parent",
            label: "Primary wave",
            primary: true,
            name: "Follow The Repo",
            availableDropCount: 1,
            dropCount: 1,
            hitCap: false,
            oldestDropAt: "2026-06-18T01:00:00.000Z",
            newestDropAt: "2026-06-18T01:00:00.000Z",
            searchedMessages: 1,
          },
          {
            waveId: "wave-firehose",
            label: "Raw PR feed",
            primary: false,
            name: "PR Firehose",
            availableDropCount: 1,
            dropCount: 1,
            hitCap: false,
            oldestDropAt: "2026-06-18T02:00:00.000Z",
            newestDropAt: "2026-06-18T02:00:00.000Z",
            searchedMessages: 1,
          },
        ],
      },
      sampleDrops: [],
    } as never);
    vi.mocked(estimateWaveBriefDraftCost).mockReturnValue({
      provider: "openai",
      modelName: "gpt-4.1-mini",
      promptTokens: 1234,
      maxOutputTokens: 1800,
      estimatedCostUsd: 0.003374,
      costCapUsd: 0.25,
      costCapExceeded: false,
      pricingAvailable: true,
      promptDropCount: 1,
      promptOmittedDropCount: 0,
      fetchedDropCount: 1,
    });

    const response = await POST(
      createRequest({
        waveId: "wave-parent",
        requestText: "Summarize the PR pipeline.",
        maxMessages: 50,
        includeAllHistory: true,
        provider: "openai",
        modelName: "gpt-4.1-mini",
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
    expect(body.preview.briefEstimate).toEqual({
      provider: "openai",
      modelName: "gpt-4.1-mini",
      promptTokens: 1234,
      maxOutputTokens: 1800,
      estimatedCostUsd: 0.003374,
      costCapUsd: 0.25,
      costCapExceeded: false,
      pricingAvailable: true,
      promptDropCount: 1,
      promptOmittedDropCount: 0,
      fetchedDropCount: 1,
    });
    expect(fetchWaveContext).toHaveBeenCalledWith({
      waveId: "wave-parent",
      requestText: "Summarize the PR pipeline.",
      maxMessages: 50,
      includeAllHistory: true,
      provider: "openai",
      modelName: "gpt-4.1-mini",
      relatedWaves: [
        {
          waveId: "https://6529.io/waves/wave-firehose",
          label: "Raw PR feed",
        },
      ],
    });
    expect(buildWaveContextPreview).toHaveBeenCalledWith({
      waveId: "wave-parent",
      waveContext: expect.objectContaining({
        drops: [{ id: "drop-1", content: "Parent drop" }],
      }),
    });
    expect(estimateWaveBriefDraftCost).toHaveBeenCalledWith({
      waveId: "wave-parent",
      requestText: "Summarize the PR pipeline.",
      drops: [{ id: "drop-1", content: "Parent drop" }],
      context: expect.objectContaining({
        mode: "all",
      }),
      provider: "openai",
      modelName: "gpt-4.1-mini",
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "admin.wave_context_previewed",
        metadata: expect.objectContaining({
          dropCount: 2,
          maxMessages: 50,
          includeAllHistory: true,
          relatedWaveCount: 1,
          promptTokens: 1234,
          estimatedCostUsd: 0.003374,
        }),
      }),
    );
  });
});
