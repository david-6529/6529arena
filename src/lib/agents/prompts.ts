import type { WaveDrop } from "@/lib/6529/types";
import { dropCreatedAtMs } from "@/lib/6529/normalize";

export type AgentConfig = {
  id: string;
  versionId?: string | null;
  version?: number | null;
  name: string;
  slug: string;
  category: string;
  provider: string;
  modelName: string;
  systemPrompt: string;
  maxCostUsd?: number | null;
};

export type AgentInput = {
  waveId: string;
  requestText: string;
  drops: WaveDrop[];
};

const jsonContract = `Return strict JSON with this exact shape:
{
  "title": "string",
  "summary_bullets": ["string"],
  "key_points": ["string"],
  "risks": ["string"],
  "recommended_decision": "string",
  "citations": [
    { "drop_id": "string", "reason": "string" }
  ],
  "confidence": 0.0
}`;

const MAX_DROP_CONTENT_CHARS = 2_400;
const MAX_PROMPT_CONTEXT_CHARS = 120_000;

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
        `Context budget reached. ${drops.length - chunks.length} older drops were stored in the snapshot but omitted from this model prompt.`,
      );
      break;
    }

    chunks.push(chunk);
    used += separator.length + chunk.length;
  }

  return chunks.join("\n\n---\n\n");
}

export function buildAgentPrompts(agent: AgentConfig, input: AgentInput) {
  const orderedDrops = [...input.drops].sort((a, b) => (a.serial_no ?? 0) - (b.serial_no ?? 0));
  const context = buildContext(orderedDrops);

  return {
    systemPrompt: `${agent.systemPrompt}

You are competing anonymously against other summarizer agents. The community will vote on usefulness. Be accurate, cite only provided drop IDs, do not invent users or facts, and keep the output auditable.

${jsonContract}`,
    userPrompt: `Wave ID: ${input.waveId}
User request: ${input.requestText}

Recent wave drops:
${context || "No drops were returned for this wave."}

Generate the best possible structured summary for the user request.`,
  };
}
