import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "@/lib/ai/pricing";

describe("estimateCostUsd", () => {
  it("calculates known provider model costs from token counts", () => {
    expect(
      estimateCostUsd({
        provider: "openai",
        modelName: "gpt-4.1-mini",
        promptTokens: 1_000_000,
        completionTokens: 500_000,
      }),
    ).toBe(1.2);
  });

  it("returns undefined for unknown models", () => {
    expect(
      estimateCostUsd({
        provider: "unknown",
        modelName: "model",
        promptTokens: 1_000,
        completionTokens: 1_000,
      }),
    ).toBeUndefined();
  });
});
