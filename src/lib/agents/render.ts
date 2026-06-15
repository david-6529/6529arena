import type { StructuredSummary } from "@/lib/agents/schema";

function renderList(items: string[]) {
  if (!items.length) {
    return "- Not enough signal in the fetched drops.";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

export function renderStructuredSummary(summary: StructuredSummary) {
  const citations = summary.citations.length
    ? summary.citations.map((citation) => `- ${citation.drop_id}: ${citation.reason}`).join("\n")
    : "- No citations supplied.";

  return `**${summary.title}**

**Summary**
${renderList(summary.summary_bullets)}

**Key points**
${renderList(summary.key_points)}

**Risks / objections**
${renderList(summary.risks)}

**Recommended decision**
${summary.recommended_decision || "No decision recommendation supplied."}

**Citations**
${citations}

Confidence: ${Math.round(summary.confidence * 100)}%`;
}

export function renderBattlePost(params: {
  battleUrl: string;
  optionA: string;
  optionB: string;
}) {
  return `I generated two competing summaries for this wave.

Vote for the one that is more useful for understanding the discussion and making a decision.

**Option A**
${params.optionA}

**Option B**
${params.optionB}

Voting criteria: accuracy, completeness, clarity, useful citations, no hallucinations.

Battle page: ${params.battleUrl}`;
}
