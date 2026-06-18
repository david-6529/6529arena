import type { WaveBriefPayload } from "@/lib/briefs/schema";

function renderList(items: string[]) {
  if (!items.length) {
    return "- None found in the fetched context.";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function renderDropIds(ids: string[]) {
  return ids.length ? ` Sources: ${ids.join(", ")}` : "";
}

export function renderWaveBrief(brief: WaveBriefPayload) {
  const decisions = brief.decisions_needed.length
    ? brief.decisions_needed
      .map((item) => `- ${item.title}${item.why ? `: ${item.why}` : ""}${renderDropIds(item.source_drop_ids)}`)
      .join("\n")
    : "- No explicit decisions found.";
  const questions = brief.open_questions.length
    ? brief.open_questions
      .map((item) => `- ${item.question}${renderDropIds(item.source_drop_ids)}`)
      .join("\n")
    : "- No open questions found.";
  const tasks = brief.action_items.length
    ? brief.action_items
      .map((item) => `- ${item.task}${item.suggested_owner ? ` Owner: ${item.suggested_owner}.` : ""}${renderDropIds(item.source_drop_ids)}`)
      .join("\n")
    : "- No action items found.";
  const risks = brief.risks.length
    ? brief.risks
      .map((item) => `- [${item.severity}] ${item.risk}${renderDropIds(item.source_drop_ids)}`)
      .join("\n")
    : "- No major risks found.";
  const citations = brief.citations.length
    ? brief.citations.map((citation) => `- ${citation.drop_id}: ${citation.reason}`).join("\n")
    : "- No citations supplied.";

  return `**${brief.title}**

**Executive summary**
${brief.executive_summary}

**What changed**
${renderList(brief.summary_bullets)}

**Decisions needed**
${decisions}

**Open questions**
${questions}

**Action items**
${tasks}

**Risks / objections**
${risks}

**Suggested post**
${brief.suggested_post || "No suggested post supplied."}

**Citations**
${citations}

Confidence: ${Math.round(brief.confidence * 100)}%`;
}

export function renderWaveBriefPost(params: {
  appUrl: string;
  briefId: string;
  content: string;
}) {
  return `Agent-assisted wave brief:

${params.content}`;
}
