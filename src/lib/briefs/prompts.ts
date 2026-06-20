import type { WaveDrop } from "@/lib/6529/types";
import { dropCreatedAtMs } from "@/lib/6529/normalize";

const MAX_DROP_CONTENT_CHARS = 2_000;
const MAX_PROMPT_CONTEXT_CHARS = 140_000;

const jsonContract = `Return strict JSON with this exact shape:
{
  "title": "string",
  "wave_type": "community_chat|project_ops|engineering_release|governance_decision|creative_drop",
  "wave_type_label": "string",
  "executive_summary": "string",
  "evidence_coverage": {
    "summary": "string",
    "limitations": ["string"]
  },
  "sections": [
    {
      "title": "string",
      "bullets": [
        { "text": "string", "source_drop_ids": ["string"] }
      ]
    }
  ],
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
  const chunksNewestFirst: string[] = [];
  let used = 0;
  let omittedDropCount = 0;

  for (let index = drops.length - 1; index >= 0; index -= 1) {
    const drop = drops[index]!;
    const chunk = formatDrop(drop);
    const separator = chunksNewestFirst.length ? "\n\n---\n\n" : "";

    if (used + separator.length + chunk.length > MAX_PROMPT_CONTEXT_CHARS) {
      omittedDropCount = index + 1;
      break;
    }

    chunksNewestFirst.push(chunk);
    used += separator.length + chunk.length;
  }

  const chunks = chunksNewestFirst.reverse();

  if (omittedDropCount) {
    chunks.unshift(
      `Prompt context includes the newest ${chunks.length} of ${drops.length} fetched drops. ${omittedDropCount} older fetched drops are stored for operator audit but omitted from this model prompt because of the context budget.`,
    );
  }

  return {
    text: chunks.join("\n\n---\n\n"),
    includedDropCount: chunksNewestFirst.length,
    omittedDropCount,
  };
}

export type WaveBriefPromptStats = {
  fetchedDropCount: number;
  promptDropCount: number;
  promptOmittedDropCount: number;
};

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
    return "No previous checked check-in was found for this wave.";
  }

  return `previous_checkin_id=${previousSummary.id} status=${previousSummary.status} created=${previousSummary.createdAt.toISOString()}${previousSummary.postDropId ? ` posted_drop=${previousSummary.postDropId}` : ""}
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

export type WaveBriefPromptContext = {
  from?: string | null;
  to?: string | null;
  mode?: string;
  includeAllHistory?: boolean;
  maxMessages?: number;
  maxMessagesPerWave?: number;
  searchedMessages?: number;
  hitCap?: boolean;
  explicitWindow?: boolean;
  sources?: Array<{
    waveId: string;
    label: string;
    primary: boolean;
    name: string | null;
    availableDropCount?: number | null;
    dropCount: number;
    hitCap?: boolean;
    oldestDropAt?: string | null;
    newestDropAt?: string | null;
    searchedMessages: number;
  }>;
};

function buildEvidenceCoverageContext(params: {
  context?: WaveBriefPromptContext;
  fetchedDropCount: number;
  includedDropCount: number;
  omittedDropCount: number;
}) {
  const context = params.context;

  if (!context) {
    return [
      `coverage_mode=unknown fetched_drops=${params.fetchedDropCount} prompt_drops=${params.includedDropCount} prompt_omitted_drops=${params.omittedDropCount}`,
      "No fetch metadata was supplied with this check-in request.",
    ].join("\n");
  }

  const lines = [
    `coverage_mode=${context.mode ?? "unknown"} include_all_history=${context.includeAllHistory === true} explicit_window=${context.explicitWindow === true}`,
    `window_from=${context.from ?? "none"} window_to=${context.to ?? "none"}`,
    `fetched_drops=${params.fetchedDropCount} searched_messages=${context.searchedMessages ?? "unknown"} max_messages=${context.maxMessages ?? "unknown"} max_messages_per_wave=${context.maxMessagesPerWave ?? "unknown"}`,
    `prompt_drops=${params.includedDropCount} prompt_omitted_drops=${params.omittedDropCount} hit_fetch_cap=${context.hitCap === true}`,
  ];

  if (context.sources?.length) {
    lines.push("source_coverage:");

    for (const source of context.sources) {
      lines.push(
        `- ${source.name ?? source.waveId} (${source.waveId}) role=${source.label} primary=${source.primary} fetched=${source.dropCount} available=${source.availableDropCount ?? "unknown"} searched=${source.searchedMessages} hit_cap=${source.hitCap === true} oldest=${source.oldestDropAt ?? "unknown"} newest=${source.newestDropAt ?? "unknown"}`,
      );
    }
  }

  return lines.join("\n");
}

export function buildWaveBriefPrompts(params: {
  waveId: string;
  requestText: string;
  drops: WaveDrop[];
  context?: WaveBriefPromptContext;
  previousSummary?: PreviousWaveSummary;
}) {
  const orderedDrops = sortDropsChronologically(params.drops);
  const promptContext = buildContext(orderedDrops);
  const previousSummaryContext = buildPreviousSummaryContext(params.previousSummary);
  const waveSourcesContext = buildWaveSourcesContext(orderedDrops);
  const evidenceCoverageContext = buildEvidenceCoverageContext({
    context: params.context,
    fetchedDropCount: orderedDrops.length,
    includedDropCount: promptContext.includedDropCount,
    omittedDropCount: promptContext.omittedDropCount,
  });

  return {
    stats: {
      fetchedDropCount: orderedDrops.length,
      promptDropCount: promptContext.includedDropCount,
      promptOmittedDropCount: promptContext.omittedDropCount,
    } satisfies WaveBriefPromptStats,
    systemPrompt: `You are a source-grounded 6529 wave check-in assistant.

Your job is to help anyone in the wave catch up quickly. Turn wave discussion into a clear check-in note with decisions, open questions, follow-ups, risks, suggested public recap, evidence coverage, and source citations. Preserve uncertainty, do not invent consensus, and cite only provided drop IDs. Keep claims source-linked. Do not include secrets or private assumptions.

When source waves include raw bot feeds, bot digests, and human coordination chats, keep those layers distinct. Explain what appears automated, what appears human-reviewed or human-coordinated, and what cannot be proven from the provided drops.

First classify the wave into exactly one wave_type:
- community_chat: social discussion, onboarding, broad conversation, morale, casual questions.
- project_ops: planning, tasks, owners, roadmaps, workstream coordination.
- engineering_release: PRs, deploys, incidents, bugs, branches, staging, production, validation.
- governance_decision: proposals, votes, policy, consensus, tradeoffs, approvals.
- creative_drop: art, memes, mints, collecting, PFPs, curation, creator feedback.

Then use sections that fit that type instead of forcing every wave into the same buckets:
- community_chat sections should focus on main thread, notable replies, open loops, and useful context.
- project_ops sections should focus on current state, owners or work, blockers, and next move.
- engineering_release sections should focus on shipped or queued work, deploy state, validation, blockers, and release risk.
- governance_decision sections should focus on proposal, positions, unresolved points, and decision path.
- creative_drop sections should focus on what was shared, reactions, opportunities, and next action.
Use 3 to 5 sections. Each section should have 1 to 4 short bullets. Do not add empty sections. Do not create fake decisions, tasks, or risks just to fill legacy fields.

Use evidence_coverage to state what was fetched and what was not directly in the model prompt. If prompt_omitted_drops is greater than 0, say older stored drops should be checked before treating the note as complete-history analysis.
Use "check-in" language for the user-facing note. Checks are for citations, follow-ups, and posting safety; the note itself can be read privately without approval. The JSON field names for decisions, questions, action_items, risks, and suggested_post are legacy machine fields. Fill them only when that content is actually present.

${jsonContract}`,
    userPrompt: `Wave ID: ${params.waveId}
Check-in request: ${params.requestText}

Evidence coverage metadata:
${evidenceCoverageContext}

Wave sources covered:
${waveSourcesContext}

Previous checked check-in:
${previousSummaryContext}

Recent wave drops:
${promptContext.text || "No drops were returned for this wave."}

Generate a concise but actionable wave check-in. Classify the wave_type, then organize the visible sections around that wave type. If a previous check-in exists, fill changes_since_previous with material changes supported by current source drops. If no previous check-in exists, keep changes_since_previous empty and use summary_bullets for the first catch-up.`,
  };
}
