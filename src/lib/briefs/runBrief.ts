import { generateWithAnthropic } from "@/lib/ai/anthropic";
import { generateWithGoogle } from "@/lib/ai/google";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { runProviderCall } from "@/lib/ai/retry";
import { buildWaveBriefPrompts } from "@/lib/briefs/prompts";
import { renderWaveBrief } from "@/lib/briefs/render";
import { parseWaveBrief, type WaveBriefPayload } from "@/lib/briefs/schema";
import type { WaveDrop } from "@/lib/6529/types";

type BriefProvider = "openai" | "anthropic" | "google";

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

export async function runWaveBrief(params: {
  waveId: string;
  requestText: string;
  drops: WaveDrop[];
  provider?: string;
  modelName?: string;
  maxOutputTokens?: number;
}): Promise<WaveBriefRunResult> {
  const provider = configuredProvider(params.provider ?? process.env.WAVE_BRIEF_PROVIDER);
  const modelName = params.modelName || process.env.WAVE_BRIEF_MODEL || defaultModel(provider);
  const prompts = buildWaveBriefPrompts({
    waveId: params.waveId,
    requestText: params.requestText,
    drops: params.drops,
  });
  const startedAt = Date.now();
  const generation = await runProviderCall(`${provider}/${modelName}:wave-brief`, async () =>
    provider === "openai"
      ? generateWithOpenAI({
          modelName,
          systemPrompt: prompts.systemPrompt,
          userPrompt: prompts.userPrompt,
          maxOutputTokens: params.maxOutputTokens ?? 1800,
        })
      : provider === "anthropic"
        ? generateWithAnthropic({
            modelName,
            systemPrompt: prompts.systemPrompt,
            userPrompt: prompts.userPrompt,
            maxOutputTokens: params.maxOutputTokens ?? 1800,
          })
        : generateWithGoogle({
            modelName,
            systemPrompt: prompts.systemPrompt,
            userPrompt: prompts.userPrompt,
            maxOutputTokens: params.maxOutputTokens ?? 1800,
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
