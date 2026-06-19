import type { WaveDrop } from "@/lib/6529/types";
import { dropCreatedAtMs } from "@/lib/6529/normalize";

const MAX_DROP_CONTENT_CHARS = 2_000;
const MAX_PROMPT_CONTEXT_CHARS = 140_000;

const jsonContract = `Return strict JSON with this exact shape:
{
  "title": "string",
  "executive_summary": "string",
  "summary_bullets": ["string"],
  "changes_since_previous": [
    { "change": "string", "source_drop_ids": ["string"] }
  ],
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
  const sourceWave = drop.source_wave_id
    ? ` source_wave=${drop.source_wave_name ?? drop.source_wave_id} source_wave_id=${drop.source_wave_id} source_role=${drop.source_wave_role ?? "wave"}`
    : "";
  const content = truncateText((drop.content ?? "").replace(/\s+/g, " ").trim(), MAX_DROP_CONTENT_CHARS);

  return `drop_id=${drop.id} serial=${drop.serial_no ?? "n/a"} author=${authorName(drop)} created=${created}${sourceWave}${title}\n${content}`;
}

function buildContext(drops: WaveDrop[]) {
  const chunks: string[] = [];
  let used = 0;

  for (const drop of drops) {
    const chunk = formatDrop(drop);
    const separator = chunks.length ? "\n\n---\n\n" : "";

    if (used + separator.length + chunk.length > MAX_PROMPT_CONTEXT_CHARS) {
      chunks.push(
        `Context budget reached. ${drops.length - chunks.length} older drops were stored with the summary but omitted from this model prompt.`,
      );
      break;
    }

    chunks.push(chunk);
    used += separator.length + chunk.length;
  }

  return chunks.join("\n\n---\n\n");
}

function sortDropsChronologically(drops: WaveDrop[]) {
  return [...drops].sort((a, b) => {
    const aCreated = dropCreatedAtMs(a) ?? 0;
    const bCreated = dropCreatedAtMs(b) ?? 0;

    if (aCreated !== bCreated) {
      return aCreated - bCreated;
    }

    return (a.serial_no ?? 0) - (b.serial_no ?? 0);
  });
}

function buildWaveSourcesContext(drops: WaveDrop[]) {
  const sourcesById = new Map<string, { name: string | null; role: string | null; count: number }>();

  for (const drop of drops) {
    if (!drop.source_wave_id) {
      continue;
    }

    const existing = sourcesById.get(drop.source_wave_id);

    if (existing) {
      existing.count += 1;
      continue;
    }

    sourcesById.set(drop.source_wave_id, {
      name: drop.source_wave_name ?? null,
      role: drop.source_wave_role ?? null,
      count: 1,
    });
  }

  if (!sourcesById.size) {
    return "Single wave context only.";
  }

  return [...sourcesById.entries()]
    .map(([waveId, source]) => {
      const name = source.name ? `${source.name} ` : "";
      const role = source.role ? ` role=${source.role}` : "";

      return `- ${name}(${waveId})${role}: ${source.count} drops`;
    })
    .join("\n");
}

function buildPreviousSummaryContext(previousSummary: PreviousWaveSummary | undefined) {
  if (!previousSummary) {
    return "No previous reviewed summary was found for this wave.";
  }

  return `previous_summary_id=${previousSummary.id} status=${previousSummary.status} created=${previousSummary.createdAt.toISOString()}${previousSummary.postDropId ? ` posted_drop=${previousSummary.postDropId}` : ""}
title=${previousSummary.title}
${truncateText(previousSummary.content.replace(/\s+/g, " ").trim(), 6_000)}`;
}

export type PreviousWaveSummary = {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: Date;
  postDropId?: string | null;
};

export function buildWaveBriefPrompts(params: {
  waveId: string;
  requestText: string;
  drops: WaveDrop[];
  previousSummary?: PreviousWaveSummary;
}) {
  const orderedDrops = sortDropsChronologically(params.drops);
  const context = buildContext(orderedDrops);
  const previousSummaryContext = buildPreviousSummaryContext(params.previousSummary);
  const waveSourcesContext = buildWaveSourcesContext(orderedDrops);

  return {
    systemPrompt: `You are a source-grounded 6529 wave summarizer.

Your job is to help anyone in the wave catch up quickly. Turn wave discussion into a clear summary with decisions, open questions, follow-ups, risks, suggested public recap, and source citations. Preserve uncertainty, do not invent consensus, and cite only provided drop IDs. Keep claims source-linked. Do not include secrets or private assumptions.

${jsonContract}`,
    userPrompt: `Wave ID: ${params.waveId}
Summary request: ${params.requestText}

Wave sources covered:
${waveSourcesContext}

Previous reviewed summary:
${previousSummaryContext}

Recent wave drops:
${context || "No drops were returned for this wave."}

Generate a concise but actionable wave summary. Focus on what changed since the previous reviewed summary, what happened, what needs a decision, what follow-ups emerged, what risks exist, and what public recap someone could send back into the wave if useful. If a previous summary exists, fill changes_since_previous with material changes supported by current source drops. If no previous summary exists, keep changes_since_previous empty and use summary_bullets for the first catch-up.`,
  };
}
