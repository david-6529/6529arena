import Anthropic from "@anthropic-ai/sdk";
import { estimateCostUsd } from "@/lib/ai/pricing";
import type { ProviderGeneration } from "@/lib/ai/openai";

export async function generateWithAnthropic(params: {
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required to run Anthropic agents.");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: params.modelName,
    max_tokens: params.maxOutputTokens ?? 1200,
    temperature: 0.2,
    system: `${params.systemPrompt}\n\nReturn only a JSON object. Do not wrap it in markdown.`,
    messages: [{ role: "user", content: params.userPrompt }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const promptTokens = response.usage.input_tokens;
  const completionTokens = response.usage.output_tokens;

  return {
    text,
    promptTokens,
    completionTokens,
    costUsd: estimateCostUsd({
      provider: "anthropic",
      modelName: params.modelName,
      promptTokens,
      completionTokens,
    }),
  } satisfies ProviderGeneration;
}
