import { GoogleGenAI } from "@google/genai";
import { estimateCostUsd } from "@/lib/ai/pricing";
import type { ProviderGeneration } from "@/lib/ai/openai";

export async function generateWithGoogle(params: {
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
}) {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is required to run Gemini agents.");
  }

  const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  const response = await client.models.generateContent({
    model: params.modelName,
    contents: `${params.systemPrompt}\n\n${params.userPrompt}`,
    config: {
      temperature: 0.2,
      maxOutputTokens: params.maxOutputTokens ?? 1200,
      responseMimeType: "application/json",
    },
  });

  const promptTokens = response.usageMetadata?.promptTokenCount;
  const completionTokens = response.usageMetadata?.candidatesTokenCount;

  return {
    text: response.text ?? "",
    promptTokens,
    completionTokens,
    costUsd: estimateCostUsd({
      provider: "google",
      modelName: params.modelName,
      promptTokens,
      completionTokens,
    }),
  } satisfies ProviderGeneration;
}
