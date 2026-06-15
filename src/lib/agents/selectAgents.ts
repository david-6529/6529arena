import type { AgentConfig } from "@/lib/agents/prompts";

export function selectBattleAgents(
  agents: AgentConfig[],
  options: {
    category: string;
    selectedAgentIds?: string[];
  },
) {
  const activeInCategory = agents.filter((agent) => agent.category === options.category);

  if (options.selectedAgentIds?.length) {
    const uniqueIds = [...new Set(options.selectedAgentIds)];

    if (uniqueIds.length !== options.selectedAgentIds.length) {
      throw Object.assign(new Error("Selected battle agents must be distinct."), { status: 422 });
    }

    const selected = uniqueIds
      .map((id) => activeInCategory.find((agent) => agent.id === id))
      .filter((agent): agent is AgentConfig => Boolean(agent));

    if (selected.length !== uniqueIds.length || selected.length !== 2) {
      throw Object.assign(new Error("Selected agents must be active in the battle category."), { status: 422 });
    }

    return selected;
  }

  return [...activeInCategory]
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
}
