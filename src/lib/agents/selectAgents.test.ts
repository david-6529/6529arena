import { describe, expect, it } from "vitest";
import { selectBattleAgents } from "@/lib/agents/selectAgents";
import type { AgentConfig } from "@/lib/agents/prompts";

const agents: AgentConfig[] = [
  {
    id: "a",
    name: "A",
    slug: "a",
    category: "Wave Summarization",
    provider: "openai",
    modelName: "model",
    systemPrompt: "prompt",
    maxCostUsd: 0.1,
  },
  {
    id: "b",
    name: "B",
    slug: "b",
    category: "Wave Summarization",
    provider: "openai",
    modelName: "model",
    systemPrompt: "prompt",
    maxCostUsd: 0.1,
  },
  {
    id: "c",
    name: "C",
    slug: "c",
    category: "Code Review",
    provider: "openai",
    modelName: "model",
    systemPrompt: "prompt",
    maxCostUsd: 0.1,
  },
];

describe("selectBattleAgents", () => {
  it("returns exactly the explicitly selected active category agents", () => {
    expect(
      selectBattleAgents(agents, {
        category: "Wave Summarization",
        selectedAgentIds: ["a", "b"],
      }).map((agent) => agent.id),
    ).toEqual(["a", "b"]);
  });

  it("rejects duplicate explicit selections", () => {
    expect(() =>
      selectBattleAgents(agents, {
        category: "Wave Summarization",
        selectedAgentIds: ["a", "a"],
      }),
    ).toThrow("distinct");
  });

  it("rejects explicit selections outside the category", () => {
    expect(() =>
      selectBattleAgents(agents, {
        category: "Wave Summarization",
        selectedAgentIds: ["a", "c"],
      }),
    ).toThrow("active in the battle category");
  });
});
