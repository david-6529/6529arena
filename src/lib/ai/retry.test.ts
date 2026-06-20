import { afterEach, describe, expect, it } from "vitest";
import { runProviderCall } from "@/lib/ai/retry";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("runProviderCall", () => {
  it("returns successful provider results", async () => {
    process.env.AI_PROVIDER_RETRIES = "0";
    process.env.AI_PROVIDER_TIMEOUT_MS = "100";

    await expect(runProviderCall("provider/model", async () => "ok")).resolves.toBe("ok");
  });

  it("surfaces provider errors after configured retries are exhausted", async () => {
    process.env.AI_PROVIDER_RETRIES = "0";
    process.env.AI_PROVIDER_TIMEOUT_MS = "100";

    await expect(
      runProviderCall("provider/model", async () => {
        throw new Error("provider failed");
      }),
    ).rejects.toThrow("provider failed");
  });

  it("times out slow provider calls", async () => {
    process.env.AI_PROVIDER_RETRIES = "0";
    process.env.AI_PROVIDER_TIMEOUT_MS = "1";

    await expect(
      runProviderCall(
        "provider/model",
        () => new Promise((resolve) => setTimeout(() => resolve("late"), 50)),
      ),
    ).rejects.toThrow("provider/model timed out after 1ms.");
  });

  it("uses a longer timeout for local Ollama calls", async () => {
    process.env.AI_PROVIDER_RETRIES = "0";
    process.env.AI_PROVIDER_TIMEOUT_MS = "1";
    process.env.OLLAMA_PROVIDER_TIMEOUT_MS = "100";

    await expect(
      runProviderCall(
        "ollama/qwen3:14b:wave-brief",
        () => new Promise((resolve) => setTimeout(() => resolve("ok"), 20)),
      ),
    ).resolves.toBe("ok");
  });
});
