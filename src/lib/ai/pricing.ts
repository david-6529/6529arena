type Price = {
  inputPerMillion: number;
  outputPerMillion: number;
};

const prices: Record<string, Price> = {
  "openai:gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "openai:gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
  "anthropic:claude-sonnet-4-5": { inputPerMillion: 3, outputPerMillion: 15 },
  "google:gemini-2.0-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
};

export function estimateCostUsd(params: {
  provider: string;
  modelName: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
}) {
  const price = prices[`${params.provider}:${params.modelName}`];

  if (!price) {
    return undefined;
  }

  const input = ((params.promptTokens ?? 0) / 1_000_000) * price.inputPerMillion;
  const output = ((params.completionTokens ?? 0) / 1_000_000) * price.outputPerMillion;

  return Number((input + output).toFixed(6));
}
