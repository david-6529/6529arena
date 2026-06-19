import { Prisma } from "@/generated/prisma/client";
import { waveBriefSchema, type WaveBriefPayload } from "@/lib/briefs/schema";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";
import { inferWaveTaskWorkflowLabel } from "@/lib/workflows/task-workflows";

export const waveTaskStatuses = ["suggested", "confirmed", "in_progress", "completed", "rejected"] as const;

export type WaveTaskStatus = (typeof waveTaskStatuses)[number];

export type SuggestedWaveTask = {
  title: string;
  suggestedOwner: string | null;
  sourceDropIds: string[];
};

export type WaveTaskOutcomeInput = {
  outcomeDropId?: string | null;
  outcomeUrl?: string | null;
  outcomeSummary?: string | null;
};

export type WaveTaskOutcomeReviewInput = {
  outcomeScore?: number | null;
  outcomeScoreNotes?: string | null;
  outcomeReviewedBy?: string;
  reviewedBy?: string;
};

export type WaveTaskOutcomeScore = 1 | 2 | 3 | 4 | 5;

export type WaveTaskOutcomeStats = {
  completedCount: number;
  evidenceCount: number;
  scoredCount: number;
  unscoredCompletedCount: number;
  averageOutcomeScore: number | null;
  strongOutcomeCount: number;
  weakOutcomeCount: number;
  outcomeScoreDistribution: Record<WaveTaskOutcomeScore, number>;
};

export type WaveTaskOwnerStats = {
  owner: string;
  totalTrackedCount: number;
  openCount: number;
  completedCount: number;
  evidenceCount: number;
  scoredCount: number;
  unscoredCompletedCount: number;
  averageOutcomeScore: number | null;
  strongOutcomeCount: number;
  weakOutcomeCount: number;
};

export type WaveTaskWorkflowStats = {
  workflowLabel: string;
  totalTrackedCount: number;
  openCount: number;
  repeatedOpenCount: number;
  completedCount: number;
  evidenceCount: number;
  scoredCount: number;
  unscoredCompletedCount: number;
  averageOutcomeScore: number | null;
  strongOutcomeCount: number;
  weakOutcomeCount: number;
};

export type WaveTaskWaveStats = {
  waveId: string;
  totalTrackedCount: number;
  openCount: number;
  repeatedOpenCount: number;
  completedCount: number;
  evidenceCount: number;
  scoredCount: number;
  unscoredCompletedCount: number;
  averageOutcomeScore: number | null;
  strongOutcomeCount: number;
  weakOutcomeCount: number;
};

type WaveTaskOwnerStatsRow = {
  status: string;
  suggestedOwner: string | null;
  assignedTo: string | null;
  claimedBy: string | null;
  outcomeDropId: string | null;
  outcomeUrl: string | null;
  outcomeSummary: string | null;
  outcomeScore: number | null;
};

type WaveTaskWaveStatsRow = {
  waveId: string;
  status: string;
  seenCount: number;
  outcomeDropId: string | null;
  outcomeUrl: string | null;
  outcomeSummary: string | null;
  outcomeScore: number | null;
};

type WaveTaskWorkflowStatsRow = {
  workflowLabel: string | null;
  status: string;
  seenCount: number;
  outcomeDropId: string | null;
  outcomeUrl: string | null;
  outcomeSummary: string | null;
  outcomeScore: number | null;
};

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function compactText(value: string, maxLength: number) {
  const compacted = value.trim().replace(/\s+/g, " ");

  return compacted.length > maxLength ? compacted.slice(0, maxLength - 1).trimEnd() : compacted;
}

function normalizeCommentBody(body: string) {
  const compacted = compactText(body, 2000);

  if (!compacted) {
    throw Object.assign(new Error("Task comment cannot be empty."), { status: 400 });
  }

  return compacted;
}

function normalizeWorkflowLabel(value: string | null | undefined) {
  return value === undefined ? undefined : compactText(value ?? "", 80) || null;
}

function workflowLabelForNewTask(title: string, explicitLabel: string | null | undefined) {
  const normalized = normalizeWorkflowLabel(explicitLabel);

  if (normalized !== undefined) {
    return normalized;
  }

  return inferWaveTaskWorkflowLabel(title);
}

export function getWaveTaskDedupeKey(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeWaveTaskOutcome(input: WaveTaskOutcomeInput) {
  const outcomeDropId = input.outcomeDropId ? compactText(input.outcomeDropId, 120) || null : null;
  const outcomeUrl = input.outcomeUrl ? compactText(input.outcomeUrl, 500) || null : null;
  const outcomeSummary = input.outcomeSummary ? compactText(input.outcomeSummary, 1000) || null : null;

  return {
    outcomeDropId,
    outcomeUrl,
    outcomeSummary,
    hasOutcome: Boolean(outcomeDropId || outcomeUrl || outcomeSummary),
  };
}

export function normalizeWaveTaskOutcomeReview(input: WaveTaskOutcomeReviewInput) {
  if (
    input.outcomeScore !== undefined &&
    input.outcomeScore !== null &&
    (!Number.isInteger(input.outcomeScore) || input.outcomeScore < 1 || input.outcomeScore > 5)
  ) {
    throw Object.assign(new Error("Task outcome score must be an integer from 1 to 5."), { status: 400 });
  }

  const outcomeScore = input.outcomeScore === undefined ? undefined : input.outcomeScore;
  const outcomeScoreNotes =
    input.outcomeScoreNotes === undefined ? undefined : compactText(input.outcomeScoreNotes ?? "", 1000) || null;
  const reviewer = compactText(input.outcomeReviewedBy ?? input.reviewedBy ?? "", 120) || null;

  return {
    outcomeScore,
    outcomeScoreNotes,
    reviewer,
  };
}

function dedupeSuggestedTasks(tasks: SuggestedWaveTask[]) {
  const seen = new Set<string>();

  return tasks.filter((task) => {
    const key = getWaveTaskDedupeKey(task.title);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mergeSourceDropIds(existing: unknown, next: string[]) {
  return [
    ...new Set([
      ...toStringArray(existing).map((dropId) => dropId.trim()),
      ...next.map((dropId) => dropId.trim()),
    ].filter(Boolean)),
  ];
}

function emptyOutcomeScoreDistribution(): Record<WaveTaskOutcomeScore, number> {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
}

function zeroWaveTaskOutcomeStats(): WaveTaskOutcomeStats {
  return {
    completedCount: 0,
    evidenceCount: 0,
    scoredCount: 0,
    unscoredCompletedCount: 0,
    averageOutcomeScore: null,
    strongOutcomeCount: 0,
    weakOutcomeCount: 0,
    outcomeScoreDistribution: emptyOutcomeScoreDistribution(),
  };
}

function resolveTaskOwner(row: Pick<WaveTaskOwnerStatsRow, "assignedTo" | "claimedBy" | "suggestedOwner">) {
  return (
    compactText(row.assignedTo ?? "", 120) ||
    compactText(row.claimedBy ?? "", 120) ||
    compactText(row.suggestedOwner ?? "", 120) ||
    "unassigned"
  );
}

function buildOutcomeScoreDistribution(
  rows: Array<{ outcomeScore: number | null; _count: { _all: number } }>,
): Record<WaveTaskOutcomeScore, number> {
  const distribution = emptyOutcomeScoreDistribution();

  for (const row of rows) {
    if (row.outcomeScore === 1 || row.outcomeScore === 2 || row.outcomeScore === 3 || row.outcomeScore === 4 || row.outcomeScore === 5) {
      distribution[row.outcomeScore] = row._count._all;
    }
  }

  return distribution;
}

export function buildWaveTaskOwnerStats(rows: WaveTaskOwnerStatsRow[], limit = 6): WaveTaskOwnerStats[] {
  const ownerStats = new Map<
    string,
    WaveTaskOwnerStats & {
      scoreTotal: number;
    }
  >();

  for (const row of rows) {
    if (row.status === "rejected") {
      continue;
    }

    const owner = resolveTaskOwner(row);
    const ownerKey = owner.toLowerCase();
    const stats =
      ownerStats.get(ownerKey) ??
      {
        owner,
        totalTrackedCount: 0,
        openCount: 0,
        completedCount: 0,
        evidenceCount: 0,
        scoredCount: 0,
        unscoredCompletedCount: 0,
        averageOutcomeScore: null,
        strongOutcomeCount: 0,
        weakOutcomeCount: 0,
        scoreTotal: 0,
      };

    stats.totalTrackedCount += 1;

    if (row.status === "completed") {
      stats.completedCount += 1;

      if (row.outcomeDropId || row.outcomeUrl || row.outcomeSummary) {
        stats.evidenceCount += 1;
      }

      if (row.outcomeScore == null) {
        stats.unscoredCompletedCount += 1;
      } else {
        stats.scoredCount += 1;
        stats.scoreTotal += row.outcomeScore;

        if (row.outcomeScore >= 4) {
          stats.strongOutcomeCount += 1;
        } else if (row.outcomeScore <= 2) {
          stats.weakOutcomeCount += 1;
        }
      }
    } else {
      stats.openCount += 1;
    }

    ownerStats.set(ownerKey, stats);
  }

  return [...ownerStats.values()]
    .map(({ scoreTotal, ...stats }) => ({
      ...stats,
      averageOutcomeScore: stats.scoredCount > 0 ? scoreTotal / stats.scoredCount : null,
    }))
    .sort((left, right) => {
      if (right.openCount !== left.openCount) {
        return right.openCount - left.openCount;
      }

      if (right.completedCount !== left.completedCount) {
        return right.completedCount - left.completedCount;
      }

      if ((right.averageOutcomeScore ?? -1) !== (left.averageOutcomeScore ?? -1)) {
        return (right.averageOutcomeScore ?? -1) - (left.averageOutcomeScore ?? -1);
      }

      return left.owner.localeCompare(right.owner);
    })
    .slice(0, limit);
}

export function buildWaveTaskWaveStats(rows: WaveTaskWaveStatsRow[], limit = 6): WaveTaskWaveStats[] {
  const waveStats = new Map<
    string,
    WaveTaskWaveStats & {
      scoreTotal: number;
    }
  >();

  for (const row of rows) {
    if (row.status === "rejected") {
      continue;
    }

    const stats =
      waveStats.get(row.waveId) ??
      {
        waveId: row.waveId,
        totalTrackedCount: 0,
        openCount: 0,
        repeatedOpenCount: 0,
        completedCount: 0,
        evidenceCount: 0,
        scoredCount: 0,
        unscoredCompletedCount: 0,
        averageOutcomeScore: null,
        strongOutcomeCount: 0,
        weakOutcomeCount: 0,
        scoreTotal: 0,
      };

    stats.totalTrackedCount += 1;

    if (row.status === "completed") {
      stats.completedCount += 1;

      if (row.outcomeDropId || row.outcomeUrl || row.outcomeSummary) {
        stats.evidenceCount += 1;
      }

      if (row.outcomeScore == null) {
        stats.unscoredCompletedCount += 1;
      } else {
        stats.scoredCount += 1;
        stats.scoreTotal += row.outcomeScore;

        if (row.outcomeScore >= 4) {
          stats.strongOutcomeCount += 1;
        } else if (row.outcomeScore <= 2) {
          stats.weakOutcomeCount += 1;
        }
      }
    } else {
      stats.openCount += 1;

      if (row.seenCount > 1) {
        stats.repeatedOpenCount += 1;
      }
    }

    waveStats.set(row.waveId, stats);
  }

  return [...waveStats.values()]
    .map(({ scoreTotal, ...stats }) => ({
      ...stats,
      averageOutcomeScore: stats.scoredCount > 0 ? scoreTotal / stats.scoredCount : null,
    }))
    .sort((left, right) => {
      if (right.openCount !== left.openCount) {
        return right.openCount - left.openCount;
      }

      if (right.repeatedOpenCount !== left.repeatedOpenCount) {
        return right.repeatedOpenCount - left.repeatedOpenCount;
      }

      if (right.weakOutcomeCount !== left.weakOutcomeCount) {
        return right.weakOutcomeCount - left.weakOutcomeCount;
      }

      if (right.completedCount !== left.completedCount) {
        return right.completedCount - left.completedCount;
      }

      return left.waveId.localeCompare(right.waveId);
    })
    .slice(0, limit);
}

export function buildWaveTaskWorkflowStats(rows: WaveTaskWorkflowStatsRow[], limit = 6): WaveTaskWorkflowStats[] {
  const workflowStats = new Map<
    string,
    WaveTaskWorkflowStats & {
      scoreTotal: number;
    }
  >();

  for (const row of rows) {
    if (row.status === "rejected") {
      continue;
    }

    const workflowLabel = compactText(row.workflowLabel ?? "", 80) || "unclassified";
    const workflowKey = workflowLabel.toLowerCase();
    const stats =
      workflowStats.get(workflowKey) ??
      {
        workflowLabel,
        totalTrackedCount: 0,
        openCount: 0,
        repeatedOpenCount: 0,
        completedCount: 0,
        evidenceCount: 0,
        scoredCount: 0,
        unscoredCompletedCount: 0,
        averageOutcomeScore: null,
        strongOutcomeCount: 0,
        weakOutcomeCount: 0,
        scoreTotal: 0,
      };

    stats.totalTrackedCount += 1;

    if (row.status === "completed") {
      stats.completedCount += 1;

      if (row.outcomeDropId || row.outcomeUrl || row.outcomeSummary) {
        stats.evidenceCount += 1;
      }

      if (row.outcomeScore == null) {
        stats.unscoredCompletedCount += 1;
      } else {
        stats.scoredCount += 1;
        stats.scoreTotal += row.outcomeScore;

        if (row.outcomeScore >= 4) {
          stats.strongOutcomeCount += 1;
        } else if (row.outcomeScore <= 2) {
          stats.weakOutcomeCount += 1;
        }
      }
    } else {
      stats.openCount += 1;

      if (row.seenCount > 1) {
        stats.repeatedOpenCount += 1;
      }
    }

    workflowStats.set(workflowKey, stats);
  }

  return [...workflowStats.values()]
    .map(({ scoreTotal, ...stats }) => ({
      ...stats,
      averageOutcomeScore: stats.scoredCount > 0 ? scoreTotal / stats.scoredCount : null,
    }))
    .sort((left, right) => {
      if (right.openCount !== left.openCount) {
        return right.openCount - left.openCount;
      }

      if (right.repeatedOpenCount !== left.repeatedOpenCount) {
        return right.repeatedOpenCount - left.repeatedOpenCount;
      }

      if (right.weakOutcomeCount !== left.weakOutcomeCount) {
        return right.weakOutcomeCount - left.weakOutcomeCount;
      }

      if (right.completedCount !== left.completedCount) {
        return right.completedCount - left.completedCount;
      }

      return left.workflowLabel.localeCompare(right.workflowLabel);
    })
    .slice(0, limit);
}

export function extractWaveTasksFromBriefPayload(brief: Pick<WaveBriefPayload, "action_items">): SuggestedWaveTask[] {
  const tasks = brief.action_items
    .map((item) => ({
      title: compactText(item.task, 240),
      suggestedOwner: item.suggested_owner ? compactText(item.suggested_owner, 120) : null,
      sourceDropIds: [...new Set(item.source_drop_ids.map((dropId) => dropId.trim()).filter(Boolean))],
    }))
    .filter((task) => task.title.length > 0);

  return dedupeSuggestedTasks(tasks);
}

export function extractWaveTasksFromBriefJson(briefJson: unknown): SuggestedWaveTask[] {
  const parsed = waveBriefSchema.safeParse(briefJson);

  if (!parsed.success) {
    return [];
  }

  return extractWaveTasksFromBriefPayload(parsed.data);
}

export async function createSuggestedTasksForBrief(params: {
  briefId: string;
  waveId: string;
  briefJson: unknown;
}) {
  const suggestedTasks = extractWaveTasksFromBriefJson(params.briefJson);

  if (!suggestedTasks.length) {
    return { createdCount: 0, rementionedCount: 0, skippedCount: 0 };
  }

  const db = getPrisma();
  const existingOpenTasks = await db.waveTask.findMany({
    where: {
      waveId: params.waveId,
      status: {
        notIn: ["completed", "rejected"],
      },
    },
    select: {
      id: true,
      title: true,
      workflowLabel: true,
      sourceDropIdsJson: true,
    },
  });
  const existingByKey = new Map(existingOpenTasks.map((task) => [getWaveTaskDedupeKey(task.title), task]));
  const tasks: SuggestedWaveTask[] = [];
  const rementionedTasks: Array<{
    task: SuggestedWaveTask;
    existing: (typeof existingOpenTasks)[number];
  }> = [];

  for (const task of suggestedTasks) {
    const existing = existingByKey.get(getWaveTaskDedupeKey(task.title));

    if (existing) {
      rementionedTasks.push({ task, existing });
    } else {
      tasks.push(task);
    }
  }
  const now = new Date();

  const rementionedResults = await Promise.all(
    rementionedTasks.map(({ task, existing }) => {
      const inferredWorkflowLabel = existing.workflowLabel ?? inferWaveTaskWorkflowLabel(task.title);

      return db.waveTask.update({
        where: {
          id: existing.id,
        },
        data: {
          lastSeenBriefId: params.briefId,
          lastSeenAt: now,
          seenCount: { increment: 1 },
          workflowLabel: existing.workflowLabel ? undefined : inferredWorkflowLabel,
          sourceDropIdsJson: toInputJson(mergeSourceDropIds(existing.sourceDropIdsJson, task.sourceDropIds)),
        },
      });
    }),
  );

  let createdCount = 0;

  if (tasks.length) {
    const result = await db.waveTask.createMany({
      data: tasks.map((task) => ({
        waveBriefId: params.briefId,
        lastSeenBriefId: params.briefId,
        lastSeenAt: now,
        seenCount: 1,
        waveId: params.waveId,
        title: task.title,
        workflowLabel: inferWaveTaskWorkflowLabel(task.title) ?? undefined,
        suggestedOwner: task.suggestedOwner ?? undefined,
        sourceDropIdsJson: toInputJson(task.sourceDropIds),
      })),
    });
    createdCount = result.count;
  }

  await logEvent({
    type: "wave_task.suggested",
    entityType: "wave_brief",
    entityId: params.briefId,
    actor: "operator",
    message: "Suggested wave tasks extracted from a wave check-in.",
    metadata: {
      waveId: params.waveId,
      taskCount: createdCount,
      rementionedTaskCount: rementionedResults.length,
      skippedTaskCount: 0,
    },
  });

  return { createdCount, rementionedCount: rementionedResults.length, skippedCount: 0 };
}

export async function listWaveTasks(limit = 100) {
  if (!prisma) {
    return [];
  }

  return prisma.waveTask.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      brief: {
        select: {
          id: true,
          title: true,
          status: true,
          postDropId: true,
          createdAt: true,
        },
      },
      comments: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          body: true,
          author: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function getWaveTaskOutcomeStats() {
  let db = prisma;

  if (!db) {
    try {
      db = getPrisma();
    } catch {
      return zeroWaveTaskOutcomeStats();
    }
  }

  if (!db) {
    return zeroWaveTaskOutcomeStats();
  }

  const [completedCount, scoredCount, evidenceCount, scoreAggregate, scoreGroups] = await Promise.all([
    db.waveTask.count({
      where: {
        status: "completed",
      },
    }),
    db.waveTask.count({
      where: {
        status: "completed",
        outcomeScore: {
          not: null,
        },
      },
    }),
    db.waveTask.count({
      where: {
        status: "completed",
        OR: [
          {
            outcomeDropId: {
              not: null,
            },
          },
          {
            outcomeUrl: {
              not: null,
            },
          },
          {
            outcomeSummary: {
              not: null,
            },
          },
        ],
      },
    }),
    db.waveTask.aggregate({
      where: {
        status: "completed",
        outcomeScore: {
          not: null,
        },
      },
      _avg: {
        outcomeScore: true,
      },
    }),
    db.waveTask.groupBy({
      by: ["outcomeScore"],
      where: {
        status: "completed",
        outcomeScore: {
          not: null,
        },
      },
      _count: {
        _all: true,
      },
    }),
  ]);
  const outcomeScoreDistribution = buildOutcomeScoreDistribution(scoreGroups);

  return {
    completedCount,
    evidenceCount,
    scoredCount,
    unscoredCompletedCount: Math.max(completedCount - scoredCount, 0),
    averageOutcomeScore: scoreAggregate._avg.outcomeScore,
    strongOutcomeCount: outcomeScoreDistribution[4] + outcomeScoreDistribution[5],
    weakOutcomeCount: outcomeScoreDistribution[1] + outcomeScoreDistribution[2],
    outcomeScoreDistribution,
  };
}

export async function getWaveTaskOwnerStats(limit = 6) {
  let db = prisma;

  if (!db) {
    try {
      db = getPrisma();
    } catch {
      return [];
    }
  }

  if (!db) {
    return [];
  }

  const rows = await db.waveTask.findMany({
    where: {
      status: {
        in: ["suggested", "confirmed", "in_progress", "completed"],
      },
    },
    select: {
      status: true,
      suggestedOwner: true,
      assignedTo: true,
      claimedBy: true,
      outcomeDropId: true,
      outcomeUrl: true,
      outcomeSummary: true,
      outcomeScore: true,
    },
  });

  return buildWaveTaskOwnerStats(rows, limit);
}

export async function getWaveTaskWaveStats(limit = 6) {
  let db = prisma;

  if (!db) {
    try {
      db = getPrisma();
    } catch {
      return [];
    }
  }

  if (!db) {
    return [];
  }

  const rows = await db.waveTask.findMany({
    where: {
      status: {
        in: ["suggested", "confirmed", "in_progress", "completed"],
      },
    },
    select: {
      waveId: true,
      status: true,
      seenCount: true,
      outcomeDropId: true,
      outcomeUrl: true,
      outcomeSummary: true,
      outcomeScore: true,
    },
  });

  return buildWaveTaskWaveStats(rows, limit);
}

export async function getWaveTaskWorkflowStats(limit = 6) {
  let db = prisma;

  if (!db) {
    try {
      db = getPrisma();
    } catch {
      return [];
    }
  }

  if (!db) {
    return [];
  }

  const rows = await db.waveTask.findMany({
    where: {
      status: {
        in: ["suggested", "confirmed", "in_progress", "completed"],
      },
    },
    select: {
      workflowLabel: true,
      status: true,
      seenCount: true,
      outcomeDropId: true,
      outcomeUrl: true,
      outcomeSummary: true,
      outcomeScore: true,
    },
  });

  return buildWaveTaskWorkflowStats(rows, limit);
}

export async function createManualWaveTask(params: {
  waveId: string;
  title: string;
  status?: WaveTaskStatus;
  workflowLabel?: string | null;
  suggestedOwner?: string | null;
  assignedTo?: string;
  sourceDropIds?: string[];
  reviewerNotes?: string;
  reviewedBy?: string;
  outcomeDropId?: string;
  outcomeUrl?: string;
  outcomeSummary?: string;
}) {
  const db = getPrisma();
  const sourceDropIds = [...new Set((params.sourceDropIds ?? []).map((dropId) => dropId.trim()).filter(Boolean))];
  const outcome = normalizeWaveTaskOutcome(params);
  const workflowLabel = workflowLabelForNewTask(params.title, params.workflowLabel);
  const task = await db.waveTask.create({
    data: {
      waveId: params.waveId,
      title: compactText(params.title, 240),
      status: params.status ?? "confirmed",
      workflowLabel: workflowLabel ?? undefined,
      suggestedOwner: params.suggestedOwner ? compactText(params.suggestedOwner, 120) : undefined,
      assignedTo: params.assignedTo ? compactText(params.assignedTo, 120) : undefined,
      seenCount: 1,
      sourceDropIdsJson: toInputJson(sourceDropIds),
      reviewerNotes: params.reviewerNotes,
      reviewedBy: params.reviewedBy,
      outcomeDropId: outcome.outcomeDropId ?? undefined,
      outcomeUrl: outcome.outcomeUrl ?? undefined,
      outcomeSummary: outcome.outcomeSummary ?? undefined,
      outcomeRecordedAt: outcome.hasOutcome ? new Date() : undefined,
    },
  });

  await logEvent({
    type: "wave_task.created_manual",
    entityType: "wave_task",
    entityId: task.id,
    actor: params.reviewedBy ?? "admin",
    message: "Manual wave task created by an admin.",
    metadata: {
      waveId: task.waveId,
      status: task.status,
      workflowLabel: task.workflowLabel,
      assignedTo: task.assignedTo,
      sourceDropCount: sourceDropIds.length,
      hasOutcome: outcome.hasOutcome,
    },
  });

  return task;
}

export async function createWaveTaskComment(params: {
  taskId: string;
  body: string;
  author?: string;
}) {
  const db = getPrisma();
  const task = await db.waveTask.findUnique({
    where: { id: params.taskId },
    select: {
      id: true,
      waveId: true,
      status: true,
      assignedTo: true,
      claimedBy: true,
    },
  });

  if (!task) {
    throw Object.assign(new Error("Wave task not found."), { status: 404 });
  }

  const comment = await db.waveTaskComment.create({
    data: {
      taskId: task.id,
      body: normalizeCommentBody(params.body),
      author: params.author ? compactText(params.author, 120) || undefined : undefined,
    },
  });

  await logEvent({
    type: "wave_task.comment_added",
    entityType: "wave_task",
    entityId: task.id,
    actor: comment.author ?? "operator",
    message: "Wave task comment added.",
    metadata: {
      waveId: task.waveId,
      status: task.status,
      assignedTo: task.assignedTo,
      claimedBy: task.claimedBy,
      commentId: comment.id,
      bodyLength: comment.body.length,
    },
  });

  return comment;
}

export async function updateWaveTask(params: {
  taskId: string;
  status?: WaveTaskStatus;
  title?: string;
  workflowLabel?: string | null;
  suggestedOwner?: string | null;
  assignedTo?: string | null;
  claimedBy?: string | null;
  reviewerNotes?: string | null;
  reviewedBy?: string;
  outcomeDropId?: string;
  outcomeUrl?: string;
  outcomeSummary?: string;
  outcomeScore?: number | null;
  outcomeScoreNotes?: string | null;
  outcomeReviewedBy?: string;
}) {
  const db = getPrisma();
  const existing = await db.waveTask.findUnique({ where: { id: params.taskId } });

  if (!existing) {
    throw Object.assign(new Error("Wave task not found."), { status: 404 });
  }

  const outcomePatchProvided =
    params.outcomeDropId !== undefined ||
    params.outcomeUrl !== undefined ||
    params.outcomeSummary !== undefined;
  const outcomeReviewPatchProvided = params.outcomeScore !== undefined || params.outcomeScoreNotes !== undefined;
  const assignedTo = params.assignedTo === undefined ? undefined : compactText(params.assignedTo ?? "", 120) || null;
  const claimedBy = params.claimedBy === undefined ? undefined : compactText(params.claimedBy ?? "", 120) || null;
  const outcome = normalizeWaveTaskOutcome({
    outcomeDropId: params.outcomeDropId === undefined ? existing.outcomeDropId : params.outcomeDropId,
    outcomeUrl: params.outcomeUrl === undefined ? existing.outcomeUrl : params.outcomeUrl,
    outcomeSummary: params.outcomeSummary === undefined ? existing.outcomeSummary : params.outcomeSummary,
  });
  const outcomeReview = normalizeWaveTaskOutcomeReview(params);
  const data: Prisma.WaveTaskUpdateInput = {
    title: params.title === undefined ? undefined : compactText(params.title, 240),
    workflowLabel: normalizeWorkflowLabel(params.workflowLabel),
    suggestedOwner: params.suggestedOwner === undefined ? undefined : compactText(params.suggestedOwner ?? "", 120) || null,
    assignedTo,
    claimedBy,
    reviewerNotes: params.reviewerNotes,
    reviewedBy: params.reviewedBy,
    outcomeDropId: params.outcomeDropId === undefined ? undefined : outcome.outcomeDropId,
    outcomeUrl: params.outcomeUrl === undefined ? undefined : outcome.outcomeUrl,
    outcomeSummary: params.outcomeSummary === undefined ? undefined : outcome.outcomeSummary,
    outcomeScore: outcomeReview.outcomeScore,
    outcomeScoreNotes: outcomeReview.outcomeScoreNotes,
  };

  if (params.status) {
    data.status = params.status;
    data.completedAt = params.status === "completed" ? existing.completedAt ?? new Date() : null;
  }

  if (claimedBy !== undefined) {
    data.claimedAt = claimedBy ? (claimedBy === existing.claimedBy ? existing.claimedAt ?? new Date() : new Date()) : null;
  }

  if (outcomePatchProvided) {
    data.outcomeRecordedAt = outcome.hasOutcome ? new Date() : null;
  }

  if (outcomeReviewPatchProvided) {
    const nextScore = outcomeReview.outcomeScore === undefined ? existing.outcomeScore : outcomeReview.outcomeScore;
    const nextNotes =
      outcomeReview.outcomeScoreNotes === undefined ? existing.outcomeScoreNotes : outcomeReview.outcomeScoreNotes;
    const hasOutcomeReview = nextScore !== null || Boolean(nextNotes);

    data.outcomeReviewedAt = hasOutcomeReview ? new Date() : null;
    data.outcomeReviewedBy = hasOutcomeReview ? outcomeReview.reviewer ?? existing.outcomeReviewedBy : null;
  }

  const task = await db.waveTask.update({
    where: { id: existing.id },
    data,
  });

  await logEvent({
    type: "wave_task.reviewed",
    entityType: "wave_task",
    entityId: task.id,
    actor: params.reviewedBy ?? "operator",
    message: "Wave task reviewed.",
    metadata: {
      waveId: task.waveId,
      status: task.status,
      previousStatus: existing.status,
      workflowLabel: task.workflowLabel,
      assignedTo: task.assignedTo,
      claimedBy: task.claimedBy,
      waveBriefId: task.waveBriefId,
      hasOutcome: outcome.hasOutcome,
      outcomeScore: task.outcomeScore,
    },
  });

  return task;
}
