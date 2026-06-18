import type { WaveDrop } from "@/lib/6529/types";
import { dropCreatedAtMs } from "@/lib/6529/normalize";

const MAX_DROP_CONTENT_CHARS = 2_000;
const MAX_PROMPT_CONTEXT_CHARS = 140_000;

const jsonContract = `Return strict JSON with this exact shape:
{
  "title": "string",
  "executive_summary": "string",
  "summary_bullets": ["string"],
  "decisions_needed": [
    { "title": "string", "why": "string", "source_drop_ids": ["string"] }
  ],
  "open_questions": [
    { "question": "string", "source_drop_ids": ["string"] }
  ],
  "action_items": [
    { "task": "string", "suggested_owner": "string", "source_drop_ids": ["string"] }
  ],
  "risks": [
    { "risk": "string", "severity": "low|medium|high", "source_drop_ids": ["string"] }
  ],
  "suggested_post": "string",
  "citations": [
    { "drop_id": "string", "reason": "string" }
  ],
  "confidence": 0.0
}`;

function authorName(drop: WaveDrop) {
  return drop.author?.handle ?? drop.author?.display ?? drop.author?.primary_wallet ?? "unknown";
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars - 24).trimEnd()}\n[truncated for context budget]`;
}

function formatDrop(drop: WaveDrop) {
  const createdAt = dropCreatedAtMs(drop);
  const created = createdAt ? new Date(createdAt).toISOString() : "unknown time";
  const title = drop.title ? ` title="${drop.title}"` : "";
  const content = truncateText((drop.content ?? "").replace(/\s+/g, " ").trim(), MAX_DROP_CONTENT_CHARS);

  return `drop_id=${drop.id} serial=${drop.serial_no ?? "n/a"} author=${authorName(drop)} created=${created}${title}\n${content}`;
}

function buildContext(drops: WaveDrop[]) {
  const chunks: string[] = [];
  let used = 0;

  for (const drop of drops) {
    const chunk = formatDrop(drop);
    const separator = chunks.length ? "\n\n---\n\n" : "";

    if (used + separator.length + chunk.length > MAX_PROMPT_CONTEXT_CHARS) {
      chunks.push(
        `Context budget reached. ${drops.length - chunks.length} older drops were stored in the brief but omitted from this model prompt.`,
      );
      break;
    }

    chunks.push(chunk);
    used += separator.length + chunk.length;
  }

  return chunks.join("\n\n---\n\n");
}

export function buildWaveBriefPrompts(params: {
  waveId: string;
  requestText: string;
  drops: WaveDrop[];
}) {
  const orderedDrops = [...params.drops].sort((a, b) => (a.serial_no ?? 0) - (b.serial_no ?? 0));
  const context = buildContext(orderedDrops);

  return {
    systemPrompt: `You are Wave Chief Of Staff for a 6529 wave.

Your job is to turn wave discussion into an operator-ready brief. Preserve uncertainty, do not invent consensus, and cite only provided drop IDs. Keep claims source-linked. Do not include secrets or private assumptions.

${jsonContract}`,
    userPrompt: `Wave ID: ${params.waveId}
Operator request: ${params.requestText}

Recent wave drops:
${context || "No drops were returned for this wave."}

Generate a concise but actionable wave brief for a human operator. Focus on what happened, what needs a decision, what tasks emerged, what risks exist, and what post the operator could send back into the wave.`,
  };
}
