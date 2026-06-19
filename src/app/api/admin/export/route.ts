import { z } from "zod";
import { getRequestFingerprint, handleRouteError, requireAdmin } from "@/lib/api";
import { validateWaveBriefContentSources, validateWaveBriefSources } from "@/lib/briefs/source-validation";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { getLeaderboard, type LeaderboardRow } from "@/lib/data/queries";
import { getPrisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const exportSchema = z.enum(["leaderboard", "wave-check-ins", "wave-summaries", "wave-tasks", "battles", "votes", "agent-runs"]);

function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

function parseLimit(url: URL) {
  const raw = Number(url.searchParams.get("limit") ?? 5000);
  return Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 10_000) : 5000;
}

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const url = new URL(request.url);
    const type = exportSchema.parse(url.searchParams.get("type") ?? "leaderboard");
    const limit = parseLimit(url);
    const { filename, csv, count } = await buildExport(type, limit);

    await logEvent({
      type: "admin.csv_exported",
      actor: getRequestFingerprint(request),
      message: "CSV data exported from The Doom Signal console.",
      metadata: { exportType: type, limit, count, filename },
    });

    return csvResponse(filename, csv);
  } catch (error) {
    return handleRouteError(error, request);
  }
}

async function buildExport(type: z.infer<typeof exportSchema>, limit: number) {
  if (type === "leaderboard") {
    const rows = await getLeaderboard();
    return {
      filename: "agent-arena-leaderboard.csv",
      csv: toCsv(rows, leaderboardColumns),
      count: rows.length,
    };
  }

  const db = getPrisma();

  if (type === "wave-check-ins" || type === "wave-summaries") {
    const rows = await db.waveBrief.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    return {
      filename: "doom-signal-wave-check-ins.csv",
      csv: toCsv(rows, waveSummaryColumns),
      count: rows.length,
    };
  }

  if (type === "wave-tasks") {
    const rows = await db.waveTask.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    return {
      filename: "doom-signal-wave-tasks.csv",
      csv: toCsv(rows, waveTaskColumns),
      count: rows.length,
    };
  }

  if (type === "battles") {
    const rows = await db.battle.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            entries: true,
            votes: true,
            runs: true,
            jobs: true,
          },
        },
      },
    });

    return {
      filename: "agent-arena-battles.csv",
      csv: toCsv(rows, battleColumns),
      count: rows.length,
    };
  }

  if (type === "votes") {
    const rows = await db.vote.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        battle: {
          select: {
            waveId: true,
            category: true,
            isOfficial: true,
            status: true,
          },
        },
      },
    });

    return {
      filename: "agent-arena-votes.csv",
      csv: toCsv(rows, voteColumns),
      count: rows.length,
    };
  }

  const rows = await db.agentRun.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      agent: {
        select: {
          name: true,
          slug: true,
          category: true,
        },
      },
      battle: {
        select: {
          waveId: true,
          category: true,
          isOfficial: true,
        },
      },
    },
  });

  return {
    filename: "agent-arena-agent-runs.csv",
    csv: toCsv(rows, agentRunColumns),
    count: rows.length,
  };
}

const leaderboardColumns: CsvColumn<LeaderboardRow>[] = [
  { header: "rank", value: (row) => row.rank },
  { header: "agent_id", value: (row) => row.id },
  { header: "agent_slug", value: (row) => row.slug },
  { header: "agent_name", value: (row) => row.name },
  { header: "owner", value: (row) => row.owner },
  { header: "category", value: (row) => row.category },
  { header: "cost_tier", value: (row) => row.costTier },
  { header: "provider", value: (row) => row.provider },
  { header: "model", value: (row) => row.modelName },
  { header: "battles", value: (row) => row.battles },
  { header: "wins", value: (row) => row.wins },
  { header: "win_rate", value: (row) => row.winRate },
  { header: "quality_score", value: (row) => row.qualityScore },
  { header: "routing_score", value: (row) => row.avgScore },
  { header: "value_score", value: (row) => row.valueScore },
  { header: "avg_cost", value: (row) => row.avgCost },
  { header: "effective_cost", value: (row) => row.effectiveCost },
  { header: "cost_basis", value: (row) => row.costBasis },
  { header: "avg_latency_ms", value: (row) => row.avgLatency },
  { header: "sample_size", value: (row) => row.sampleSize },
  { header: "last_active", value: (row) => row.lastActive },
];

type WaveSummaryExportRow = {
  id: string;
  previousBriefId: string | null;
  waveId: string;
  triggerDropId: string | null;
  status: string;
  title: string;
  dropsJson: unknown;
  briefJson: unknown;
  content: string;
  provider: string;
  modelName: string;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  humanScore: number | null;
  reviewedBy: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  postDropId: string | null;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    tasks: number;
  };
};

type WaveSummarySourceGateMetadata = {
  structuredReferenceCount: number;
  structuredMissingCount: number;
  finalReferenceCount: number;
  finalMissingCount: number;
  finalGate: "clear" | "blocked";
};

const waveSummarySourceGateCache = new WeakMap<WaveSummaryExportRow, WaveSummarySourceGateMetadata>();

function waveSummarySourceGateMetadata(row: WaveSummaryExportRow): WaveSummarySourceGateMetadata {
  const cached = waveSummarySourceGateCache.get(row);

  if (cached) {
    return cached;
  }

  const structuredCheck = validateWaveBriefSources(row.briefJson, row.dropsJson);
  const finalCheck = validateWaveBriefContentSources(row.content, row.dropsJson);
  const metadata: WaveSummarySourceGateMetadata = {
    structuredReferenceCount: structuredCheck.references.length,
    structuredMissingCount: structuredCheck.missingReferences.length,
    finalReferenceCount: finalCheck.references.length,
    finalMissingCount: finalCheck.missingReferences.length,
    finalGate: finalCheck.missingReferences.length ? "blocked" : "clear",
  };

  waveSummarySourceGateCache.set(row, metadata);
  return metadata;
}

const waveSummaryColumns: CsvColumn<WaveSummaryExportRow>[] = [
  { header: "checkin_id", value: (row) => row.id },
  { header: "wave_id", value: (row) => row.waveId },
  { header: "previous_checkin_id", value: (row) => row.previousBriefId },
  { header: "trigger_drop_id", value: (row) => row.triggerDropId },
  { header: "status", value: (row) => row.status },
  { header: "title", value: (row) => row.title },
  { header: "provider", value: (row) => row.provider },
  { header: "model", value: (row) => row.modelName },
  { header: "prompt_tokens", value: (row) => row.promptTokens },
  { header: "completion_tokens", value: (row) => row.completionTokens },
  { header: "cost_usd", value: (row) => row.costUsd },
  { header: "latency_ms", value: (row) => row.latencyMs },
  { header: "human_score", value: (row) => row.humanScore },
  { header: "structured_source_references", value: (row) => waveSummarySourceGateMetadata(row).structuredReferenceCount },
  { header: "structured_missing_sources", value: (row) => waveSummarySourceGateMetadata(row).structuredMissingCount },
  { header: "final_source_references", value: (row) => waveSummarySourceGateMetadata(row).finalReferenceCount },
  { header: "final_missing_sources", value: (row) => waveSummarySourceGateMetadata(row).finalMissingCount },
  { header: "final_source_gate", value: (row) => waveSummarySourceGateMetadata(row).finalGate },
  { header: "reviewed_by", value: (row) => row.reviewedBy },
  { header: "approved_at", value: (row) => row.approvedAt },
  { header: "rejected_at", value: (row) => row.rejectedAt },
  { header: "post_drop_id", value: (row) => row.postDropId },
  { header: "posted_at", value: (row) => row.postedAt },
  { header: "task_count", value: (row) => row._count.tasks },
  { header: "created_at", value: (row) => row.createdAt },
  { header: "updated_at", value: (row) => row.updatedAt },
];

type WaveTaskExportRow = {
  id: string;
  waveBriefId: string | null;
  waveId: string;
  title: string;
  status: string;
  workflowLabel: string | null;
  suggestedOwner: string | null;
  assignedTo: string | null;
  claimedBy: string | null;
  claimedAt: Date | null;
  lastSeenBriefId: string | null;
  lastSeenAt: Date | null;
  seenCount: number;
  sourceDropIdsJson: unknown;
  reviewedBy: string | null;
  outcomeDropId: string | null;
  outcomeUrl: string | null;
  outcomeRecordedAt: Date | null;
  outcomeScore: number | null;
  outcomeReviewedBy: string | null;
  outcomeReviewedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    comments: number;
  };
};

function sourceDropIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0).join(" ")
    : "";
}

const waveTaskColumns: CsvColumn<WaveTaskExportRow>[] = [
  { header: "task_id", value: (row) => row.id },
  { header: "checkin_id", value: (row) => row.waveBriefId },
  { header: "wave_id", value: (row) => row.waveId },
  { header: "title", value: (row) => row.title },
  { header: "status", value: (row) => row.status },
  { header: "workflow", value: (row) => row.workflowLabel },
  { header: "suggested_owner", value: (row) => row.suggestedOwner },
  { header: "assigned_to", value: (row) => row.assignedTo },
  { header: "claimed_by", value: (row) => row.claimedBy },
  { header: "claimed_at", value: (row) => row.claimedAt },
  { header: "last_seen_checkin_id", value: (row) => row.lastSeenBriefId },
  { header: "last_seen_at", value: (row) => row.lastSeenAt },
  { header: "seen_count", value: (row) => row.seenCount },
  { header: "source_drop_ids", value: (row) => sourceDropIds(row.sourceDropIdsJson) },
  { header: "reviewed_by", value: (row) => row.reviewedBy },
  { header: "outcome_drop_id", value: (row) => row.outcomeDropId },
  { header: "outcome_url", value: (row) => row.outcomeUrl },
  { header: "outcome_recorded_at", value: (row) => row.outcomeRecordedAt },
  { header: "outcome_score", value: (row) => row.outcomeScore },
  { header: "outcome_reviewed_by", value: (row) => row.outcomeReviewedBy },
  { header: "outcome_reviewed_at", value: (row) => row.outcomeReviewedAt },
  { header: "completed_at", value: (row) => row.completedAt },
  { header: "comment_count", value: (row) => row._count.comments },
  { header: "created_at", value: (row) => row.createdAt },
  { header: "updated_at", value: (row) => row.updatedAt },
];

type BattleExportRow = {
  id: string;
  waveId: string;
  triggerDropId: string | null;
  category: string;
  source: string;
  battleType: string;
  isOfficial: boolean;
  status: string;
  postDropId: string | null;
  votingMethod: string | null;
  winnerEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    entries: number;
    votes: number;
    runs: number;
    jobs: number;
  };
};

const battleColumns: CsvColumn<BattleExportRow>[] = [
  { header: "battle_id", value: (row) => row.id },
  { header: "wave_id", value: (row) => row.waveId },
  { header: "trigger_drop_id", value: (row) => row.triggerDropId },
  { header: "category", value: (row) => row.category },
  { header: "source", value: (row) => row.source },
  { header: "battle_type", value: (row) => row.battleType },
  { header: "is_official", value: (row) => row.isOfficial },
  { header: "status", value: (row) => row.status },
  { header: "post_drop_id", value: (row) => row.postDropId },
  { header: "voting_method", value: (row) => row.votingMethod },
  { header: "winner_entry_id", value: (row) => row.winnerEntryId },
  { header: "entries", value: (row) => row._count.entries },
  { header: "votes", value: (row) => row._count.votes },
  { header: "runs", value: (row) => row._count.runs },
  { header: "jobs", value: (row) => row._count.jobs },
  { header: "created_at", value: (row) => row.createdAt },
  { header: "updated_at", value: (row) => row.updatedAt },
];

type VoteExportRow = {
  id: string;
  battleId: string;
  voterIdentityId: string | null;
  voterHandle: string | null;
  voterWallet: string | null;
  selectedLabel: string;
  selectedEntryId: string | null;
  source: string;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
  battle: {
    waveId: string;
    category: string;
    isOfficial: boolean;
    status: string;
  };
};

const voteColumns: CsvColumn<VoteExportRow>[] = [
  { header: "vote_id", value: (row) => row.id },
  { header: "battle_id", value: (row) => row.battleId },
  { header: "wave_id", value: (row) => row.battle.waveId },
  { header: "category", value: (row) => row.battle.category },
  { header: "battle_status", value: (row) => row.battle.status },
  { header: "is_official", value: (row) => row.battle.isOfficial },
  { header: "selected_label", value: (row) => row.selectedLabel },
  { header: "selected_entry_id", value: (row) => row.selectedEntryId },
  { header: "source", value: (row) => row.source },
  { header: "weight", value: (row) => row.weight },
  { header: "voter_handle", value: (row) => row.voterHandle },
  { header: "voter_wallet", value: (row) => row.voterWallet },
  { header: "voter_identity_id", value: (row) => row.voterIdentityId },
  { header: "created_at", value: (row) => row.createdAt },
  { header: "updated_at", value: (row) => row.updatedAt },
];

type AgentRunExportRow = {
  id: string;
  agentId: string;
  agentVersionId: string | null;
  battleId: string | null;
  runType: string;
  status: string;
  provider: string;
  modelName: string;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  output: string | null;
  error: string | null;
  createdAt: Date;
  agent: {
    name: string;
    slug: string;
    category: string;
  };
  battle: {
    waveId: string;
    category: string;
    isOfficial: boolean;
  } | null;
};

const agentRunColumns: CsvColumn<AgentRunExportRow>[] = [
  { header: "run_id", value: (row) => row.id },
  { header: "agent_id", value: (row) => row.agentId },
  { header: "agent_name", value: (row) => row.agent.name },
  { header: "agent_slug", value: (row) => row.agent.slug },
  { header: "agent_category", value: (row) => row.agent.category },
  { header: "agent_version_id", value: (row) => row.agentVersionId },
  { header: "battle_id", value: (row) => row.battleId },
  { header: "wave_id", value: (row) => row.battle?.waveId },
  { header: "battle_category", value: (row) => row.battle?.category },
  { header: "is_official", value: (row) => row.battle?.isOfficial },
  { header: "run_type", value: (row) => row.runType },
  { header: "status", value: (row) => row.status },
  { header: "provider", value: (row) => row.provider },
  { header: "model", value: (row) => row.modelName },
  { header: "prompt_tokens", value: (row) => row.promptTokens },
  { header: "completion_tokens", value: (row) => row.completionTokens },
  { header: "cost_usd", value: (row) => row.costUsd },
  { header: "latency_ms", value: (row) => row.latencyMs },
  { header: "output_length", value: (row) => row.output?.length },
  { header: "error", value: (row) => row.error },
  { header: "created_at", value: (row) => row.createdAt },
];
