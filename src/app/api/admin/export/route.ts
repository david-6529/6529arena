import { z } from "zod";
import { getRequestFingerprint, handleRouteError, requireAdmin } from "@/lib/api";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { getLeaderboard, type LeaderboardRow } from "@/lib/data/queries";
import { getPrisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const exportSchema = z.enum(["leaderboard", "battles", "votes", "agent-runs"]);

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
      message: "Admin exported CSV data.",
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
