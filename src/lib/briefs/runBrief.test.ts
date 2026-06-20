import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithOllama } from "@/lib/ai/ollama";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { estimateWaveBriefDraftCost, estimateWaveBriefRunCost, getWaveBriefProviderConfig, runWaveBrief } from "@/lib/briefs/runBrief";
import type { WaveDrop } from "@/lib/6529/types";

vi.mock("@/lib/ai/openai", () => ({
  generateWithOpenAI: vi.fn(),
}));

vi.mock("@/lib/ai/ollama", () => ({
  generateWithOllama: vi.fn(),
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
const originalLocalMockMode = process.env.WAVE_BRIEF_LOCAL_MOCK_MODE;
const originalWaveBriefProvider = process.env.WAVE_BRIEF_PROVIDER;
const originalWaveBriefModel = process.env.WAVE_BRIEF_MODEL;

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

function restoreLocalMockMode() {
  if (originalLocalMockMode === undefined) {
    delete process.env.WAVE_BRIEF_LOCAL_MOCK_MODE;
  } else {
    process.env.WAVE_BRIEF_LOCAL_MOCK_MODE = originalLocalMockMode;
  }
}

function restoreWaveBriefProvider() {
  if (originalWaveBriefProvider === undefined) {
    delete process.env.WAVE_BRIEF_PROVIDER;
  } else {
    process.env.WAVE_BRIEF_PROVIDER = originalWaveBriefProvider;
  }

  if (originalWaveBriefModel === undefined) {
    delete process.env.WAVE_BRIEF_MODEL;
  } else {
    process.env.WAVE_BRIEF_MODEL = originalWaveBriefModel;
  }
}

beforeEach(() => {
  restoreCostCap();
  restoreOpenAiKey();
  restoreLocalMockMode();
  restoreWaveBriefProvider();
  vi.mocked(generateWithOpenAI).mockReset();
  vi.mocked(generateWithOllama).mockReset();
});

afterEach(() => {
  restoreCostCap();
  restoreOpenAiKey();
  restoreLocalMockMode();
  restoreWaveBriefProvider();
});

describe("estimateWaveBriefRunCost", () => {
  it("defaults wave check-ins to Ollama when no provider is configured", () => {
    delete process.env.WAVE_BRIEF_PROVIDER;
    delete process.env.WAVE_BRIEF_MODEL;
    process.env.WAVE_BRIEF_LOCAL_MOCK_MODE = "false";

    expect(getWaveBriefProviderConfig()).toEqual(
      expect.objectContaining({
        provider: "ollama",
        modelName: "qwen3:14b",
        keyName: "OLLAMA_BASE_URL",
        configured: true,
      }),
    );
  });

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
  it("generates an extractive local check-in without calling a provider", async () => {
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = "1";
    process.env.WAVE_BRIEF_LOCAL_MOCK_MODE = "true";
    delete process.env.OPENAI_API_KEY;

    const result = await runWaveBrief({
      waveId: "wave-1",
      requestText: "Create a test check-in.",
      drops: [
        {
          id: "drop-1",
          serial_no: 1,
          content: "Can we decide who owns the next deployment follow up?",
          author: { handle: "alice" },
        },
        {
          id: "drop-2",
          serial_no: 2,
          content: "There is a risk that deploys get backed up when many PRs merge.",
          author: { handle: "bob" },
        },
      ],
      provider: "openai",
      modelName: "gpt-4.1-mini",
    });

    expect(result.provider).toBe("local");
    expect(result.modelName).toBe("extractive-check-in");
    expect(result.costUsd).toBe(0);
    expect(result.structured.citations.map((citation) => citation.drop_id)).toEqual(["drop-2", "drop-1"]);
    expect(result.renderedOutput).toContain("Local test mode read 2 fetched drops");
    expect(generateWithOpenAI).not.toHaveBeenCalled();
  });

  it("generates a zero-cost Ollama check-in without requiring a provider key", async () => {
    process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD = "1";
    delete process.env.OPENAI_API_KEY;
    vi.mocked(generateWithOllama).mockResolvedValue({
      text: JSON.stringify({
        title: "Ollama check-in",
        executive_summary: "Local model summary.",
        evidence_coverage: { summary: "Fetched one drop.", limitations: [] },
        summary_bullets: ["Update shipped."],
        changes_since_previous: [],
        decisions_needed: [],
        open_questions: [],
        action_items: [],
        risks: [],
        suggested_post: "Update shipped.",
        citations: [{ drop_id: "drop-1", reason: "Source" }],
        confidence: 0.7,
      }),
      promptTokens: 100,
      completionTokens: 50,
      costUsd: 0,
    });

    const result = await runWaveBrief({
      waveId: "wave-1",
      requestText: "Create a summary.",
      drops: [{ id: "drop-1", content: "Update shipped." }],
      provider: "ollama",
      modelName: "qwen3:14b",
    });

    expect(result.provider).toBe("ollama");
    expect(result.modelName).toBe("qwen3:14b");
    expect(result.costUsd).toBe(0);
    expect(result.structured.title).toBe("Ollama check-in");
    expect(generateWithOllama).toHaveBeenCalledWith(
      expect.objectContaining({
        modelName: "qwen3:14b",
      }),
    );
    expect(generateWithOpenAI).not.toHaveBeenCalled();
  });

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
