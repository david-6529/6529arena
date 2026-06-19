import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createWaveBriefDraft, getWaveBriefByTrigger } from "@/lib/data/wave-briefs";
import { logEvent } from "@/lib/observability/events";
import { consumeRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/data/wave-briefs", () => ({
  createWaveBriefDraft: vi.fn(),
  getWaveBriefByTrigger: vi.fn(),
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
  process.env.WAVE_BRIEF_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "test-key";

  return new Request("https://arena.example/api/bot/mention", {
    method: "POST",
    headers: {
      "user-agent": "vitest",
      "x-forwarded-for": "203.0.113.9",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bot/mention", () => {
  it("creates a reviewed wave summary draft instead of autoposting", async () => {
    const resetAt = new Date("2026-06-18T12:00:00.000Z");
    vi.mocked(getWaveBriefByTrigger).mockResolvedValue(null);
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt,
    });
    vi.mocked(createWaveBriefDraft).mockResolvedValue({
      id: "brief-1",
      waveId: "wave-1",
      status: "draft",
    } as never);

    const response = await POST(
      createRequest({
        waveId: "wave-1",
        dropId: "drop-1",
        text: "@AgentArena summarize this wave",
        autoRun: true,
        autoPost: true,
        createPoll: true,
        relatedWaves: [
          {
            waveId: "wave-firehose",
            label: "Raw PR feed",
          },
        ],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      brief: {
        id: "brief-1",
        waveId: "wave-1",
        status: "draft",
      },
      remaining: 4,
      reviewRequired: true,
      reviewUrl: "https://arena.example/operator/briefs#brief-1",
      publicPostSkipped: true,
    });
    expect(consumeRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "bot_wave_brief",
        limit: 10,
        windowMs: 60 * 60 * 1000,
      }),
    );
    expect(createWaveBriefDraft).toHaveBeenCalledWith({
      waveId: "wave-1",
      triggerDropId: "drop-1",
      requestText: "@AgentArena summarize this wave",
      contextFrom: undefined,
      contextTo: undefined,
      maxMessages: undefined,
      includeAllHistory: undefined,
      relatedWaves: [
        {
          waveId: "wave-firehose",
          label: "Raw PR feed",
        },
      ],
      provider: undefined,
      modelName: undefined,
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "bot.mention_summary_draft_created",
        entityType: "wave_brief",
        entityId: "brief-1",
        actor: "bot",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          triggerDropId: "drop-1",
          relatedWaveCount: 1,
          autoPostRequested: true,
          createPollRequested: true,
        }),
      }),
    );
  });

  it("reuses an existing draft for repeated trigger drops", async () => {
    vi.mocked(getWaveBriefByTrigger).mockResolvedValue({
      id: "brief-existing",
      waveId: "wave-1",
      triggerDropId: "drop-1",
      status: "draft",
    } as never);

    const response = await POST(
      createRequest({
        waveId: "wave-1",
        dropId: "drop-1",
        text: "@AgentArena summarize this wave",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      brief: {
        id: "brief-existing",
        waveId: "wave-1",
        triggerDropId: "drop-1",
        status: "draft",
      },
      deduped: true,
      reviewRequired: true,
      reviewUrl: "https://arena.example/operator/briefs#brief-existing",
      publicPostSkipped: false,
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(createWaveBriefDraft).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "bot.mention_summary_deduped",
        entityId: "brief-existing",
      }),
    );
  });

  it("fails closed when the configured provider key is missing", async () => {
    vi.mocked(getWaveBriefByTrigger).mockResolvedValue(null);
    const request = createRequest({
      waveId: "wave-1",
      text: "@AgentArena summarize this wave",
    });

    delete process.env.OPENAI_API_KEY;

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Wave check-in generation is disabled because OPENAI_API_KEY is not configured.",
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(createWaveBriefDraft).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.provider_config_missing",
        actor: "bot",
      }),
    );
  });
});
