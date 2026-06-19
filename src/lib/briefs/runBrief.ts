import { generateWithAnthropic } from "@/lib/ai/anthropic";
import { generateWithGoogle } from "@/lib/ai/google";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { runProviderCall } from "@/lib/ai/retry";
import { buildWaveBriefPrompts, type PreviousWaveSummary, type WaveBriefPromptContext } from "@/lib/briefs/prompts";
import { renderWaveBrief } from "@/lib/briefs/render";
import { parseWaveBrief, type WaveBriefPayload } from "@/lib/briefs/schema";
import type { WaveDrop } from "@/lib/6529/types";

export type BriefProvider = "openai" | "anthropic" | "google";

export const defaultWaveBriefMaxOutputTokens = 1800;

export type WaveBriefRunResult = {
  provider: BriefProvider;
  modelName: string;
  rawOutput: string;
  structured: WaveBriefPayload;
  renderedOutput: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  latencyMs: number;
};

export type WaveBriefCostPreview = {
  provider: BriefProvider;
  modelName: string;
  promptTokens: number;
  maxOutputTokens: number;
  estimatedCostUsd: number | null;
  costCapUsd: number | null;
  costCapExceeded: boolean;
  pricingAvailable: boolean;
  promptDropCount: number;
  promptOmittedDropCount: number;
  fetchedDropCount: number;
};

function configuredProvider(value?: string): BriefProvider {
  if (value === "anthropic" || value === "google" || value === "openai") {
    return value;
  }

  return "openai";
}

function defaultModel(provider: BriefProvider) {
  if (provider === "anthropic") {
    return "claude-sonnet-4-5";
  }

  if (provider === "google") {
    return "gemini-2.0-flash";
  }

  return "gpt-4.1-mini";
}

function apiKeyName(provider: BriefProvider) {
  if (provider === "anthropic") {
    return "ANTHROPIC_API_KEY";
  }

  if (provider === "google") {
    return "GOOGLE_API_KEY";
  }

  return "OPENAI_API_KEY";
}

export function getWaveBriefProviderConfig(params?: { provider?: string; modelName?: string }) {
  const provider = configuredProvider(params?.provider ?? process.env.WAVE_BRIEF_PROVIDER);
  const modelName = params?.modelName || process.env.WAVE_BRIEF_MODEL || defaultModel(provider);
  const keyName = apiKeyName(provider);

  return {
    provider,
    modelName,
    keyName,
    configured: Boolean(process.env[keyName]?.trim()),
  };
}

function assertProviderConfigured(provider: BriefProvider) {
  const { keyName, configured } = getWaveBriefProviderConfig({ provider });

  if (!configured) {
    throw Object.assign(new Error(`${keyName} is required to generate ${provider} wave check-ins.`), {
      status: 422,
      code: "provider_not_configured",
    });
  }
}

export function getWaveBriefEstimatedCostCapUsd() {
  const configured = Number(process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD ?? 0.25);

  return Number.isFinite(configured) && configured > 0 ? configured : null;
}

function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4);
}

export function estimateWaveBriefRunCost(params: {
  provider: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
}) {
  const promptTokens = estimateTokenCount(`${params.systemPrompt}\n\n${params.userPrompt}`);

  return {
    promptTokens,
    maxOutputTokens: params.maxOutputTokens,
    estimatedCostUsd: estimateCostUsd({
      provider: params.provider,
      modelName: params.modelName,
      promptTokens,
      completionTokens: params.maxOutputTokens,
    }),
  };
}

export function estimateWaveBriefDraftCost(params: {
  waveId: string;
  requestText: string;
  drops: WaveDrop[];
  context?: WaveBriefPromptContext;
  provider?: string;
  modelName?: string;
  maxOutputTokens?: number;
  previousSummary?: PreviousWaveSummary;
}): WaveBriefCostPreview {
  const providerConfig = getWaveBriefProviderConfig(params);
  const maxOutputTokens = params.maxOutputTokens ?? defaultWaveBriefMaxOutputTokens;
  const prompts = buildWaveBriefPrompts({
    waveId: params.waveId,
    requestText: params.requestText,
    drops: params.drops,
    context: params.context,
    previousSummary: params.previousSummary,
  });
  const estimate = estimateWaveBriefRunCost({
    provider: providerConfig.provider,
    modelName: providerConfig.modelName,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    maxOutputTokens,
  });
  const costCapUsd = getWaveBriefEstimatedCostCapUsd();
  const estimatedCostUsd = estimate.estimatedCostUsd ?? null;

  return {
    provider: providerConfig.provider,
    modelName: providerConfig.modelName,
    promptTokens: estimate.promptTokens,
    maxOutputTokens,
    estimatedCostUsd,
    costCapUsd,
    costCapExceeded: Boolean(costCapUsd != null && estimatedCostUsd != null && estimatedCostUsd > costCapUsd),
    pricingAvailable: estimatedCostUsd != null,
    promptDropCount: prompts.stats.promptDropCount,
    promptOmittedDropCount: prompts.stats.promptOmittedDropCount,
    fetchedDropCount: prompts.stats.fetchedDropCount,
  };
}

export async function runWaveBrief(params: {
  waveId: string;
  requestText: string;
  drops: WaveDrop[];
  context?: WaveBriefPromptContext;
  provider?: string;
  modelName?: string;
  maxOutputTokens?: number;
  previousSummary?: PreviousWaveSummary;
}): Promise<WaveBriefRunResult> {
  const providerConfig = getWaveBriefProviderConfig(params);
  const provider = providerConfig.provider;
  const modelName = providerConfig.modelName;
  const maxOutputTokens = params.maxOutputTokens ?? defaultWaveBriefMaxOutputTokens;
  const prompts = buildWaveBriefPrompts({
    waveId: params.waveId,
    requestText: params.requestText,
    drops: params.drops,
    context: params.context,
    previousSummary: params.previousSummary,
  });
  const costCap = getWaveBriefEstimatedCostCapUsd();
  const estimate = estimateWaveBriefRunCost({
    provider,
    modelName,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    maxOutputTokens,
  });

  if (costCap === null) {
    throw Object.assign(
      new Error("MAX_WAVE_BRIEF_ESTIMATED_COST_USD must be a positive number to generate wave check-ins."),
      {
        status: 503,
        code: "wave_brief_cost_cap_invalid",
      },
    );
  }

  if (estimate.estimatedCostUsd === undefined) {
    throw Object.assign(new Error(`Wave check-in cost cap requires pricing for ${provider}/${modelName}.`), {
      status: 422,
    });
  }

  const estimatedCostUsd = estimate.estimatedCostUsd;

  if (estimatedCostUsd > costCap) {
    throw Object.assign(
      new Error(`Estimated wave check-in cost $${estimatedCostUsd.toFixed(2)} exceeds cap $${costCap.toFixed(2)}.`),
      { status: 422 },
    );
  }

  assertProviderConfigured(provider);

  const startedAt = Date.now();
  const generation = await runProviderCall(`${provider}/${modelName}:wave-brief`, async () =>
    provider === "openai"
      ? generateWithOpenAI({
          modelName,
          systemPrompt: prompts.systemPrompt,
          userPrompt: prompts.userPrompt,
          maxOutputTokens,
        })
      : provider === "anthropic"
        ? generateWithAnthropic({
            modelName,
            systemPrompt: prompts.systemPrompt,
            userPrompt: prompts.userPrompt,
            maxOutputTokens,
          })
        : generateWithGoogle({
            modelName,
            systemPrompt: prompts.systemPrompt,
            userPrompt: prompts.userPrompt,
            maxOutputTokens,
          }),
  );
  const structured = parseWaveBrief(generation.text);

  return {
    provider,
    modelName,
    rawOutput: generation.text,
    structured,
    renderedOutput: renderWaveBrief(structured),
    promptTokens: generation.promptTokens,
    completionTokens: generation.completionTokens,
    costUsd: generation.costUsd,
    latencyMs: Date.now() - startedAt,
  };
}
