import type { ProviderGeneration } from "@/lib/ai/openai";

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
};

function ollamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434").replace(/\/+$/, "");
}

function cleanOllamaJson(text: string) {
  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const start = withoutThinking.indexOf("{");
  const end = withoutThinking.lastIndexOf("}");

  return start >= 0 && end > start ? withoutThinking.slice(start, end + 1) : withoutThinking;
}

function ollamaSetupError(message: string) {
  return Object.assign(new Error(message), {
    status: 422,
    code: "ollama_not_ready",
  });
}

export async function generateWithOllama(params: {
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
}) {
  let response: Response;

  try {
    response = await fetch(`${ollamaBaseUrl()}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: params.modelName,
        stream: false,
        format: "json",
        think: false,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
        options: {
          temperature: 0.2,
          num_predict: params.maxOutputTokens ?? 1200,
        },
      }),
    });
  } catch {
    throw ollamaSetupError(`Ollama is not reachable at ${ollamaBaseUrl()}. Start it with: brew services start ollama`);
  }

  const body = (await response.json().catch(() => ({}))) as OllamaChatResponse;

  if (!response.ok || body.error) {
    const message = body.error || `Ollama request failed with status ${response.status}.`;

    if (response.status === 404 || /not found|pull model|model/i.test(message)) {
      throw ollamaSetupError(`Ollama model ${params.modelName} is not installed yet. Run: ollama pull ${params.modelName}`);
    }

    throw Object.assign(new Error(message), { status: 422, code: "ollama_request_failed" });
  }

  return {
    text: cleanOllamaJson(body.message?.content ?? ""),
    promptTokens: body.prompt_eval_count,
    completionTokens: body.eval_count,
    costUsd: 0,
  } satisfies ProviderGeneration;
}
