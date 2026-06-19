export type WaveTaskWorkflowTemplate = {
  label: string;
  description: string;
  keywords: string[];
};

export const waveTaskWorkflowTemplates: WaveTaskWorkflowTemplate[] = [
  {
    label: "grants",
    description: "Funding, grant review, rubrics, awards, budgets, and reviewer follow-up.",
    keywords: ["grant", "funding", "rubric", "award", "budget", "reviewer", "retro funding"],
  },
  {
    label: "governance",
    description: "Votes, policy, proposals, quorum, treasury, and delegation work.",
    keywords: ["vote", "voting", "governance", "proposal", "quorum", "policy", "delegate", "treasury"],
  },
  {
    label: "product/build",
    description: "Product, engineering, releases, implementation, bugs, and roadmap work.",
    keywords: ["build", "product", "feature", "roadmap", "release", "ship", "bug", "deploy", "code", "implementation"],
  },
  {
    label: "art curation",
    description: "Art, artists, collections, mints, galleries, editions, and curation.",
    keywords: ["art", "artist", "curation", "collection", "mint", "gallery", "edition"],
  },
  {
    label: "community support",
    description: "Member help, onboarding, moderation, FAQs, documentation, and support.",
    keywords: ["support", "help", "onboard", "onboarding", "moderation", "community", "member", "faq", "docs"],
  },
  {
    label: "meme creation",
    description: "Memes, remixes, captions, image briefs, contests, and creative production.",
    keywords: ["meme", "remix", "caption", "poster", "image", "contest", "creative"],
  },
];

export const waveTaskWorkflowLabels = waveTaskWorkflowTemplates.map((template) => template.label);

function normalizeForKeywordMatch(value: string) {
  return ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

export function inferWaveTaskWorkflowLabel(text: string) {
  const normalizedText = normalizeForKeywordMatch(text);

  for (const template of waveTaskWorkflowTemplates) {
    if (template.keywords.some((keyword) => normalizedText.includes(normalizeForKeywordMatch(keyword)))) {
      return template.label;
    }
  }

  return null;
}
