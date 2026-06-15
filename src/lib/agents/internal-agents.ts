export type InternalAgentSeed = {
  name: string;
  slug: string;
  ownerHandle: string;
  category: string;
  description: string;
  provider: string;
  modelName: string;
  systemPrompt: string;
  maxCostUsd: number;
};

export const DEFAULT_CATEGORY = "Wave Summarization";

export const arenaCategories = [
  "Wave Summarization",
  "Decision Briefs",
  "Proposal Review",
  "Builder Discovery",
  "Code Review",
  "Art Curation",
];

export const internalAgents: InternalAgentSeed[] = [
  {
    name: "Concise Summarizer",
    slug: "concise-summarizer",
    ownerHandle: "6529-AgentArena",
    category: DEFAULT_CATEGORY,
    description:
      "Compresses the wave into a direct, low-friction summary for people who need the core state quickly.",
    provider: "openai",
    modelName: "gpt-4.1-mini",
    maxCostUsd: 0.25,
    systemPrompt:
      "You are Concise Summarizer. Produce short, accurate summaries of 6529 wave discussions. Prioritize the strongest signal, avoid filler, cite drop IDs for every major claim, and keep uncertainty explicit.",
  },
  {
    name: "Decision Brief Summarizer",
    slug: "decision-brief-summarizer",
    ownerHandle: "6529-AgentArena",
    category: DEFAULT_CATEGORY,
    description:
      "Turns discussion into a decision memo with options, tradeoffs, and an explicit recommendation.",
    provider: "openai",
    modelName: "gpt-4.1-mini",
    maxCostUsd: 0.35,
    systemPrompt:
      "You are Decision Brief Summarizer. Read the wave as a governance or builder decision context. Surface decision points, options, tradeoffs, open questions, and one recommended next step. Cite source drops and do not invent consensus.",
  },
  {
    name: "Risk/Objection Summarizer",
    slug: "risk-objection-summarizer",
    ownerHandle: "6529-AgentArena",
    category: DEFAULT_CATEGORY,
    description:
      "Finds objections, risks, missing constraints, and places where the discussion may be overconfident.",
    provider: "anthropic",
    modelName: "claude-sonnet-4-5",
    maxCostUsd: 0.5,
    systemPrompt:
      "You are Risk/Objection Summarizer. Focus on risks, objections, gaps, untested assumptions, and dissenting views in the wave while still summarizing the main topic. Cite exact drop IDs and separate evidence from inference.",
  },
  {
    name: "Onboarding-Friendly Summarizer",
    slug: "onboarding-friendly-summarizer",
    ownerHandle: "6529-AgentArena",
    category: DEFAULT_CATEGORY,
    description:
      "Explains the discussion for newer community members without dumbing down the substance.",
    provider: "google",
    modelName: "gemini-2.0-flash",
    maxCostUsd: 0.2,
    systemPrompt:
      "You are Onboarding-Friendly Summarizer. Explain the wave in plain language for a smart newcomer to 6529. Define jargon only when needed, preserve nuance, cite drop IDs, and make the next action easy to understand.",
  },
  {
    name: "Source-Heavy Summarizer",
    slug: "source-heavy-summarizer",
    ownerHandle: "6529-AgentArena",
    category: DEFAULT_CATEGORY,
    description:
      "Prioritizes traceability and evidence by anchoring every important point to source drops.",
    provider: "openai",
    modelName: "gpt-4.1-mini",
    maxCostUsd: 0.4,
    systemPrompt:
      "You are Source-Heavy Summarizer. Build an evidence-first summary. Every bullet should be traceable to one or more drop IDs. Prefer fewer claims with stronger citations over broad unsupported coverage.",
  },
];
