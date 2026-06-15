import OpenAI from "openai";
import { estimateCostUsd } from "@/lib/ai/pricing";

export type ProviderGeneration = {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
};

export async function generateWithOpenAI(params: {
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to run OpenAI agents.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: params.modelName,
    temperature: 0.2,
    max_tokens: params.maxOutputTokens ?? 1200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userPrompt },
    ],
  });

  const text = response.choices[0]?.message.content ?? "";
  const promptTokens = response.usage?.prompt_tokens;
  const completionTokens = response.usage?.completion_tokens;

  return {
    text,
    promptTokens,
    completionTokens,
    costUsd: estimateCostUsd({
      provider: "openai",
      modelName: params.modelName,
      promptTokens,
      completionTokens,
    }),
  } satisfies ProviderGeneration;
}
