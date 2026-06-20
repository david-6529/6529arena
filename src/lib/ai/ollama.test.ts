import { afterEach, describe, expect, it, vi } from "vitest";
import { generateWithOllama } from "@/lib/ai/ollama";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("generateWithOllama", () => {
  it("disables hidden reasoning so JSON responses contain usable content", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "{\"ok\":true}" }, prompt_eval_count: 8, eval_count: 4 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      generateWithOllama({
        modelName: "qwen3:14b",
        systemPrompt: "Return JSON.",
        userPrompt: "Summarize.",
      }),
    ).resolves.toMatchObject({
      text: "{\"ok\":true}",
      promptTokens: 8,
      completionTokens: 4,
      costUsd: 0,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/chat",
      expect.objectContaining({
        body: expect.stringContaining("\"think\":false"),
      }),
    );
  });

  it("returns a readable setup error when the model is not installed", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "model qwen3:14b not found, try pulling it first" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      generateWithOllama({
        modelName: "qwen3:14b",
        systemPrompt: "Return JSON.",
        userPrompt: "Summarize.",
      }),
    ).rejects.toMatchObject({
      message: "Ollama model qwen3:14b is not installed yet. Run: ollama pull qwen3:14b",
      status: 422,
      code: "ollama_not_ready",
    });
  });
});
