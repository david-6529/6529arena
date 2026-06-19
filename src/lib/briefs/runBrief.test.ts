import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { estimateWaveBriefDraftCost, estimateWaveBriefRunCost, runWaveBrief } from "@/lib/briefs/runBrief";
import type { WaveDrop } from "@/lib/6529/types";

vi.mock("@/lib/ai/openai", () => ({
  generateWithOpenAI: vi.fn(),
}));

vi.mock("@/lib/ai/anthropic", () => ({
  generateWithAnthropic: vi.fn(),
}));

vi.mock("@/lib/ai/google", () => ({
  generateWithGoogle: vi.fn(),
}));

vi.mock("@/lib/ai/retry", () => ({
  runProviderCall: vi.fn((_label: string, operation: () => Promise<unknown>) => operation()),
}));

const originalCostCap = process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

function restoreCostCap() {
  if (originalCostCap === undefined) {
    delete process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD;
  } else {
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = originalCostCap;
  }
}

function restoreOpenAiKey() {
  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
}

beforeEach(() => {
  restoreCostCap();
  restoreOpenAiKey();
  vi.mocked(generateWithOpenAI).mockReset();
});

afterEach(() => {
  restoreCostCap();
  restoreOpenAiKey();
});

describe("estimateWaveBriefRunCost", () => {
  it("estimates prompt and max-output cost for known summary models", () => {
    const estimate = estimateWaveBriefRunCost({
      provider: "openai",
      modelName: "gpt-4.1-mini",
      systemPrompt: "System prompt.",
      userPrompt: "Summarize this wave.",
      maxOutputTokens: 1000,
    });

    expect(estimate.promptTokens).toBeGreaterThan(0);
    expect(estimate.maxOutputTokens).toBe(1000);
    expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("previews draft prompt cost and prompt drop coverage without provider keys", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = "0.25";

    const preview = estimateWaveBriefDraftCost({
      waveId: "wave-1",
      requestText: "Create a summary.",
      drops: [{ id: "drop-1", content: "Update" }],
      provider: "openai",
      modelName: "gpt-4.1-mini",
    });

    expect(preview).toEqual(
      expect.objectContaining({
        provider: "openai",
        modelName: "gpt-4.1-mini",
        maxOutputTokens: 1800,
        costCapUsd: 0.25,
        costCapExceeded: false,
        pricingAvailable: true,
        promptDropCount: 1,
        promptOmittedDropCount: 0,
        fetchedDropCount: 1,
      }),
    );
    expect(preview.promptTokens).toBeGreaterThan(0);
    expect(preview.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("marks draft cost preview as unpriced for unknown models", () => {
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = "0.25";

    const preview = estimateWaveBriefDraftCost({
      waveId: "wave-1",
      requestText: "Create a summary.",
      drops: [{ id: "drop-1", content: "Update" }],
      provider: "openai",
      modelName: "unknown-model",
    });

    expect(preview).toEqual(
      expect.objectContaining({
        provider: "openai",
        modelName: "unknown-model",
        estimatedCostUsd: null,
        pricingAvailable: false,
        costCapExceeded: false,
      }),
    );
  });
});

describe("runWaveBrief", () => {
  it("rejects invalid cost-cap configuration before calling the provider", async () => {
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = "0";

    await expect(
      runWaveBrief({
        waveId: "wave-1",
        requestText: "Create a summary.",
        drops: [{ id: "drop-1", content: "Update" }],
        provider: "openai",
        modelName: "gpt-4.1-mini",
      }),
    ).rejects.toMatchObject({
      message: "MAX_WAVE_BRIEF_ESTIMATED_COST_USD must be a positive number to generate wave check-ins.",
      status: 503,
      code: "wave_brief_cost_cap_invalid",
    });
    expect(generateWithOpenAI).not.toHaveBeenCalled();
  });

  it("rejects over-cap wave check-ins before calling the provider", async () => {
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = "0.000001";

    const drops: WaveDrop[] = [
      {
        id: "drop-1",
        serial_no: 1,
        content: "A long enough update to create a non-zero estimated input cost.",
        author: { handle: "alice" },
      },
    ];

    await expect(
      runWaveBrief({
        waveId: "wave-1",
        requestText: "Create a summary.",
        drops,
        provider: "openai",
        modelName: "gpt-4.1-mini",
        maxOutputTokens: 1800,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("exceeds cap"),
      status: 422,
    });
    expect(generateWithOpenAI).not.toHaveBeenCalled();
  });

  it("rejects unknown model pricing when a cap is enabled", async () => {
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = "1";

    await expect(
      runWaveBrief({
        waveId: "wave-1",
        requestText: "Create a summary.",
        drops: [{ id: "drop-1", content: "Update" }],
        provider: "openai",
        modelName: "unknown-model",
      }),
    ).rejects.toMatchObject({
      message: "Wave check-in cost cap requires pricing for openai/unknown-model.",
      status: 422,
    });
    expect(generateWithOpenAI).not.toHaveBeenCalled();
  });

  it("rejects missing provider keys before calling the provider", async () => {
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = "1";
    delete process.env.OPENAI_API_KEY;

    await expect(
      runWaveBrief({
        waveId: "wave-1",
        requestText: "Create a summary.",
        drops: [{ id: "drop-1", content: "Update" }],
        provider: "openai",
        modelName: "gpt-4.1-mini",
      }),
    ).rejects.toMatchObject({
      message: "OPENAI_API_KEY is required to generate openai wave check-ins.",
      status: 422,
      code: "provider_not_configured",
    });
    expect(generateWithOpenAI).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only provider keys before calling the provider", async () => {
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = "1";
    process.env.OPENAI_API_KEY = "   ";

    await expect(
      runWaveBrief({
        waveId: "wave-1",
        requestText: "Create a summary.",
        drops: [{ id: "drop-1", content: "Update" }],
        provider: "openai",
        modelName: "gpt-4.1-mini",
      }),
    ).rejects.toMatchObject({
      message: "OPENAI_API_KEY is required to generate openai wave check-ins.",
      status: 422,
      code: "provider_not_configured",
    });
    expect(generateWithOpenAI).not.toHaveBeenCalled();
  });
});
