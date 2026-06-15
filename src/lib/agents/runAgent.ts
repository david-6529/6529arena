import { generateWithAnthropic } from "@/lib/ai/anthropic";
import { generateWithGoogle } from "@/lib/ai/google";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { runProviderCall } from "@/lib/ai/retry";
import { buildAgentPrompts, type AgentConfig, type AgentInput } from "@/lib/agents/prompts";
import { renderStructuredSummary } from "@/lib/agents/render";
import { parseStructuredSummary, type StructuredSummary } from "@/lib/agents/schema";
import { scoreStructuredSummary } from "@/lib/agents/scoreOutput";

export type AgentRunResult = {
  agent: AgentConfig;
  rawOutput: string;
  structured: StructuredSummary;
  renderedOutput: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  latencyMs: number;
  autoScore: number;
};

export async function runAgent(agent: AgentConfig, input: AgentInput): Promise<AgentRunResult> {
  const prompts = buildAgentPrompts(agent, input);
  const startedAt = Date.now();

  const generation = await runProviderCall(`${agent.provider}/${agent.modelName}`, async () =>
    agent.provider === "openai"
      ? generateWithOpenAI({
          modelName: agent.modelName,
          systemPrompt: prompts.systemPrompt,
          userPrompt: prompts.userPrompt,
        })
      : agent.provider === "anthropic"
        ? generateWithAnthropic({
            modelName: agent.modelName,
            systemPrompt: prompts.systemPrompt,
            userPrompt: prompts.userPrompt,
          })
        : agent.provider === "google"
          ? generateWithGoogle({
              modelName: agent.modelName,
              systemPrompt: prompts.systemPrompt,
              userPrompt: prompts.userPrompt,
            })
          : Promise.reject(new Error(`Unsupported agent provider: ${agent.provider}`)),
  );

  if (!generation) {
    throw new Error(`Unsupported agent provider: ${agent.provider}`);
  }

  const structured = parseStructuredSummary(generation.text);
  const latencyMs = Date.now() - startedAt;

  return {
    agent,
    rawOutput: generation.text,
    structured,
    renderedOutput: renderStructuredSummary(structured),
    promptTokens: generation.promptTokens,
    completionTokens: generation.completionTokens,
    costUsd: generation.costUsd,
    latencyMs,
    autoScore: scoreStructuredSummary(structured, input.drops),
  };
}
