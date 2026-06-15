import type { Agent, AgentVersion } from "@/generated/prisma/client";
import { internalAgents } from "@/lib/agents/internal-agents";
import type { AgentConfig } from "@/lib/agents/prompts";
import { prisma } from "@/lib/db/prisma";

export const costTiers = ["Low", "Medium", "High"] as const;
export type CostTier = (typeof costTiers)[number];

export type LeaderboardRow = {
  rank: number;
  id: string;
  slug: string;
  name: string;
  owner: string;
  category: string;
  provider: string;
  modelName: string;
  battles: number;
  wins: number;
  winRate: number;
  costTier: CostTier;
  qualityScore: number;
  avgScore: number;
  avgCost: number | null;
  effectiveCost: number | null;
  costBasis: "observed" | "configured" | "unknown";
  valueScore: number;
  avgLatency: number | null;
  sampleSize: number;
  lastActive: string | null;
};

export type CostTierWinner = {
  category: string;
  tier: CostTier;
  agent: LeaderboardRow | null;
};

const mockWaveSummarizerStats: Record<
  string,
  {
    battles: number;
    wins: number;
    qualityScore: number;
    avgScore: number;
    avgCost: number;
    avgLatency: number;
    lastActiveHoursAgo: number;
  }
> = {
  "concise-summarizer": {
    battles: 24,
    wins: 13,
    qualityScore: 0.78,
    avgScore: 0.745,
    avgCost: 0.018,
    avgLatency: 3900,
    lastActiveHoursAgo: 3,
  },
  "onboarding-friendly-summarizer": {
    battles: 18,
    wins: 10,
    qualityScore: 0.81,
    avgScore: 0.774,
    avgCost: 0.026,
    avgLatency: 4600,
    lastActiveHoursAgo: 5,
  },
  "decision-brief-summarizer": {
    battles: 22,
    wins: 14,
    qualityScore: 0.86,
    avgScore: 0.823,
    avgCost: 0.074,
    avgLatency: 7100,
    lastActiveHoursAgo: 2,
  },
  "source-heavy-summarizer": {
    battles: 16,
    wins: 11,
    qualityScore: 0.9,
    avgScore: 0.852,
    avgCost: 0.138,
    avgLatency: 9800,
    lastActiveHoursAgo: 7,
  },
  "risk-objection-summarizer": {
    battles: 20,
    wins: 12,
    qualityScore: 0.87,
    avgScore: 0.803,
    avgCost: 0.24,
    avgLatency: 12400,
    lastActiveHoursAgo: 4,
  },
};

type AgentWithVersion = Pick<
  Agent,
  "id" | "name" | "slug" | "category" | "provider" | "modelName" | "systemPrompt" | "maxCostUsd"
> & {
  versions?: Pick<AgentVersion, "id" | "version" | "provider" | "modelName" | "systemPrompt" | "maxCostUsd">[];
};

export function toAgentConfig(agent: AgentWithVersion): AgentConfig {
  const version = agent.versions?.[0];

  return {
    id: agent.id,
    versionId: version?.id,
    version: version?.version,
    name: agent.name,
    slug: agent.slug,
    category: agent.category,
    provider: version?.provider ?? agent.provider,
    modelName: version?.modelName ?? agent.modelName,
    systemPrompt: version?.systemPrompt ?? agent.systemPrompt,
    maxCostUsd: version?.maxCostUsd ?? agent.maxCostUsd,
  };
}

function fallbackAgents(): AgentConfig[] {
  return internalAgents.map((agent) => ({
    id: agent.slug,
    name: agent.name,
    slug: agent.slug,
    category: agent.category,
    provider: agent.provider,
    modelName: agent.modelName,
    systemPrompt: agent.systemPrompt,
    maxCostUsd: agent.maxCostUsd,
  }));
}

export async function getAgents() {
  if (!prisma) {
    return fallbackAgents();
  }

  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    include: {
      versions: {
        where: { isActive: true },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return agents.map(toAgentConfig);
}

export async function listAdminAgents() {
  if (!prisma) {
    return fallbackAgents().map((agent) => ({
      ...agent,
      ownerHandle: "6529-AgentArena",
      ownerWallet: null,
      description: null,
      isPublic: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [
        {
          id: `${agent.id}:fallback`,
          version: 1,
          provider: agent.provider,
          modelName: agent.modelName,
          systemPrompt: agent.systemPrompt,
          maxCostUsd: agent.maxCostUsd ?? null,
          description: null,
          isActive: true,
          createdAt: new Date(),
        },
      ],
      _count: {
        runs: 0,
        battleEntries: 0,
      },
    }));
  }

  return prisma.agent.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      versions: {
        orderBy: { version: "desc" },
      },
      _count: {
        select: {
          runs: true,
          battleEntries: true,
        },
      },
    },
  });
}

export async function getLeaderboard(category?: string | null) {
  if (!prisma) {
    return assignCostTiers(
      fallbackAgents()
      .filter((agent) => !category || agent.category === category)
      .map<Omit<LeaderboardRow, "rank" | "costTier">>((agent) => ({
        ...buildFallbackLeaderboardRow(agent),
      })),
    );
  }

  const agents = await prisma.agent.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    include: {
      battleEntries: {
        where: {
          battle: {
            isOfficial: true,
          },
        },
        include: {
          battle: {
            select: {
              winnerEntryId: true,
              updatedAt: true,
              status: true,
            },
          },
        },
      },
      runs: {
        where: {
          runType: "official",
        },
        select: {
          costUsd: true,
          latencyMs: true,
          createdAt: true,
        },
      },
    },
  });

  return assignCostTiers(
    agents
    .map((agent) => {
      const battles = agent.battleEntries.length;
      const wins = agent.battleEntries.filter((entry) => entry.battle.winnerEntryId === entry.id).length;
      const scores = agent.battleEntries
        .map((entry) => entry.finalScore ?? entry.humanScore ?? entry.autoScore)
        .filter((score): score is number => typeof score === "number");
      const costs = agent.runs
        .map((run) => run.costUsd)
        .filter((cost): cost is number => typeof cost === "number");
      const latencies = agent.runs
        .map((run) => run.latencyMs)
        .filter((latency): latency is number => typeof latency === "number");
      const lastActive = [...agent.battleEntries.map((entry) => entry.battle.updatedAt), ...agent.runs.map((run) => run.createdAt)]
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const qualityScore = scores.length ? average(scores) : 0;
      const observedCost = costs.length ? Number(average(costs).toFixed(4)) : null;
      const effectiveCost = observedCost ?? agent.maxCostUsd ?? null;
      const costPenalty = effectiveCost ? Math.min(0.15, effectiveCost / 3) : 0;
      const latencyPenalty = latencies.length ? Math.min(0.1, average(latencies) / 120_000) : 0;
      const routingScore = scores.length
        ? Number((qualityScore - costPenalty - latencyPenalty).toFixed(3))
        : 0;

      return {
        id: agent.id,
        slug: agent.slug,
        name: agent.name,
        owner: agent.ownerHandle ?? agent.ownerWallet ?? "unknown",
        category: agent.category,
        provider: agent.provider,
        modelName: agent.modelName,
        battles,
        wins,
        winRate: battles ? wins / battles : 0,
        qualityScore: Number(qualityScore.toFixed(3)),
        avgScore: routingScore,
        avgCost: observedCost,
        effectiveCost,
        costBasis: observedCost == null ? (agent.maxCostUsd == null ? "unknown" : "configured") : "observed",
        valueScore:
          scores.length && effectiveCost
            ? Number((qualityScore / Math.max(effectiveCost, 0.01)).toFixed(2))
            : 0,
        avgLatency: latencies.length ? Math.round(average(latencies)) : null,
        sampleSize: battles,
        lastActive: lastActive ? lastActive.toISOString() : null,
      };
    })
  );
}

function buildFallbackLeaderboardRow(agent: AgentConfig): Omit<LeaderboardRow, "rank" | "costTier"> {
  const mock = mockWaveSummarizerStats[agent.slug];
  const avgCost = mock?.avgCost ?? agent.maxCostUsd ?? null;
  const qualityScore = mock?.qualityScore ?? 0;

  return {
    id: agent.id,
    slug: agent.slug,
    name: agent.name,
    owner: "6529-AgentArena",
    category: agent.category,
    provider: agent.provider,
    modelName: agent.modelName,
    battles: mock?.battles ?? 0,
    wins: mock?.wins ?? 0,
    winRate: mock ? mock.wins / mock.battles : 0,
    qualityScore,
    avgScore: mock?.avgScore ?? 0,
    avgCost,
    effectiveCost: avgCost,
    costBasis: mock ? "observed" : agent.maxCostUsd == null ? "unknown" : "configured",
    valueScore: mock && avgCost ? Number((qualityScore / Math.max(avgCost, 0.01)).toFixed(2)) : 0,
    avgLatency: mock?.avgLatency ?? null,
    sampleSize: mock?.battles ?? 0,
    lastActive: mock ? new Date(Date.now() - mock.lastActiveHoursAgo * 60 * 60 * 1000).toISOString() : null,
  };
}

export function getCostTierWinners(rows: LeaderboardRow[]): CostTierWinner[] {
  const categories = [...new Set(rows.map((row) => row.category))];

  return categories.flatMap((category) =>
    costTiers.map((tier) => {
      const candidates = rows
        .filter((row) => row.category === category && row.costTier === tier)
        .sort(compareRowsForTierWinner);

      return {
        category,
        tier,
        agent: candidates[0] ?? null,
      };
    }),
  );
}

function compareRowsForTierWinner(a: LeaderboardRow, b: LeaderboardRow) {
  return (
    b.avgScore - a.avgScore ||
    b.sampleSize - a.sampleSize ||
    b.valueScore - a.valueScore ||
    (a.effectiveCost ?? Number.POSITIVE_INFINITY) - (b.effectiveCost ?? Number.POSITIVE_INFINITY)
  );
}

export function assignCostTiers(rows: Omit<LeaderboardRow, "rank" | "costTier">[]): LeaderboardRow[] {
  const grouped = new Map<string, Omit<LeaderboardRow, "rank" | "costTier">[]>();

  for (const row of rows) {
    grouped.set(row.category, [...(grouped.get(row.category) ?? []), row]);
  }

  const tiered = [...grouped.values()].flatMap((categoryRows) => {
    const sortedByCost = [...categoryRows].sort(
      (a, b) =>
        (a.effectiveCost ?? Number.POSITIVE_INFINITY) -
          (b.effectiveCost ?? Number.POSITIVE_INFINITY) || b.avgScore - a.avgScore,
    );
    const lowCut = Math.ceil(sortedByCost.length / 3);
    const mediumCut = Math.ceil((sortedByCost.length * 2) / 3);

    return sortedByCost.map((row, index) => ({
      ...row,
      costTier: (index < lowCut ? "Low" : index < mediumCut ? "Medium" : "High") as CostTier,
    }));
  });

  return tiered
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        costTiers.indexOf(a.costTier) - costTiers.indexOf(b.costTier) ||
        b.avgScore - a.avgScore ||
        b.valueScore - a.valueScore,
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getAgentProfile(slugOrId: string) {
  if (!prisma) {
    const agent = fallbackAgents().find((item) => item.slug === slugOrId || item.id === slugOrId);

    if (!agent) {
      return null;
    }

    return {
      ...agent,
      ownerHandle: "6529-AgentArena",
      ownerWallet: null,
      description: internalAgents.find((item) => item.slug === agent.slug)?.description ?? null,
      battleEntries: [],
      runs: [],
    };
  }

  return prisma.agent.findFirst({
    where: {
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    include: {
      battleEntries: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          battle: true,
          votes: true,
        },
      },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function getBattleDetail(id: string) {
  if (!prisma) {
    return null;
  }

  return prisma.battle.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: { label: "asc" },
        include: {
          agent: true,
          agentVersion: true,
          votes: true,
        },
      },
      votes: true,
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function listBattles(limit = 12) {
  if (!prisma) {
    return [];
  }

  return prisma.battle.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      entries: {
        orderBy: { label: "asc" },
        include: { agent: true },
      },
      votes: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

type AgentSubmissionFilters = {
  limit?: number;
  status?: string | null;
  category?: string | null;
  provider?: string | null;
};

export async function listAgentSubmissions(input: number | AgentSubmissionFilters = 50) {
  if (!prisma) {
    return [];
  }

  const filters = typeof input === "number" ? { limit: input } : input;

  return prisma.agentSubmission.findMany({
    take: filters.limit ?? 50,
    where: {
      ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
      ...(filters.category && filters.category !== "all" ? { category: filters.category } : {}),
      ...(filters.provider && filters.provider !== "all" ? { provider: filters.provider } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      approvedAgent: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}

export async function listSelfTestRuns(limit = 100) {
  if (!prisma) {
    return [];
  }

  return prisma.agentRun.findMany({
    where: { runType: "self_test" },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
        },
      },
      agentVersion: {
        select: {
          id: true,
          version: true,
        },
      },
    },
  });
}

export async function getAgentSubmissionFilterOptions() {
  if (!prisma) {
    return {
      statuses: ["pending", "approved", "rejected"],
      categories: [],
      providers: [],
    };
  }

  const submissions = await prisma.agentSubmission.findMany({
    select: {
      status: true,
      category: true,
      provider: true,
    },
  });

  return {
    statuses: uniqueSorted(submissions.map((submission) => submission.status), ["pending", "approved", "rejected"]),
    categories: uniqueSorted(submissions.map((submission) => submission.category)),
    providers: uniqueSorted(submissions.map((submission) => submission.provider)),
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueSorted(values: string[], defaults: string[] = []) {
  return [...new Set([...defaults, ...values].filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
