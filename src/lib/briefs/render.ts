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

function renderSections(brief: WaveBriefPayload) {
  return brief.sections
    .filter((section) => section.bullets.length)
    .map(
      (section) => `**${section.title}**
${section.bullets.map((bullet) => `- ${bullet.text}${renderDropIds(bullet.source_drop_ids)}`).join("\n")}`,
    )
    .join("\n\n");
}

function renderFollowUps(brief: WaveBriefPayload) {
  const items = [
    ...brief.decisions_needed.map((item) => `- Decide: ${item.title}${item.why ? `: ${item.why}` : ""}${renderDropIds(item.source_drop_ids)}`),
    ...brief.open_questions.map((item) => `- Question: ${item.question}${renderDropIds(item.source_drop_ids)}`),
    ...brief.action_items.map((item) => `- Follow up: ${item.task}${item.suggested_owner ? ` Owner: ${item.suggested_owner}.` : ""}${renderDropIds(item.source_drop_ids)}`),
  ];

  return items.length ? items.join("\n") : "";
}

export function renderWaveBrief(brief: WaveBriefPayload) {
  const evidenceLimitations = brief.evidence_coverage.limitations.length
    ? brief.evidence_coverage.limitations.map((item) => `- ${item}`).join("\n")
    : "- No evidence limitations were supplied.";
  const changes = brief.changes_since_previous.length
    ? brief.changes_since_previous
      .map((item) => `- ${item.change}${renderDropIds(item.source_drop_ids)}`)
      .join("\n")
    : "- No previous reviewed summary was used, or no material changes were found.";
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
  const tailoredSections = renderSections(brief);
  const followUps = renderFollowUps(brief);

  if (tailoredSections) {
    return `**${brief.title}**

**Wave type**
${brief.wave_type_label}

**Catch-up**
${brief.executive_summary}

${brief.changes_since_previous.length ? `**Changed since last check-in**\n${changes}\n\n` : ""}${tailoredSections}

${followUps ? `**Follow-ups**\n${followUps}\n\n` : ""}${brief.risks.length ? `**Risks / objections**\n${risks}\n\n` : ""}${brief.suggested_post ? `**Possible post**\n${brief.suggested_post}\n\n` : ""}**Evidence**
${brief.evidence_coverage.summary || "No evidence coverage supplied."}

${evidenceLimitations}

**Citations**
${citations}

Confidence: ${Math.round(brief.confidence * 100)}%`;
  }

  return `**${brief.title}**

**Executive summary**
${brief.executive_summary}

**Evidence coverage**
${brief.evidence_coverage.summary || "No evidence coverage supplied."}

${evidenceLimitations}

**What changed since last summary**
${changes}

**What happened**
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
  return `Agent-assisted wave check-in:

${params.content}`;
}
