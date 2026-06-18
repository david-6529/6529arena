import { Prisma } from "@/generated/prisma/client";
import { waveBriefSchema, type WaveBriefPayload } from "@/lib/briefs/schema";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

export const waveTaskStatuses = ["suggested", "confirmed", "in_progress", "completed", "rejected"] as const;

export type WaveTaskStatus = (typeof waveTaskStatuses)[number];

export type SuggestedWaveTask = {
  title: string;
  suggestedOwner: string | null;
  sourceDropIds: string[];
};

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function compactText(value: string, maxLength: number) {
  const compacted = value.trim().replace(/\s+/g, " ");

  return compacted.length > maxLength ? compacted.slice(0, maxLength - 1).trimEnd() : compacted;
}

export function extractWaveTasksFromBriefPayload(brief: Pick<WaveBriefPayload, "action_items">): SuggestedWaveTask[] {
  return brief.action_items
    .map((item) => ({
      title: compactText(item.task, 240),
      suggestedOwner: item.suggested_owner ? compactText(item.suggested_owner, 120) : null,
      sourceDropIds: [...new Set(item.source_drop_ids.map((dropId) => dropId.trim()).filter(Boolean))],
    }))
    .filter((task) => task.title.length > 0);
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
  const tasks = extractWaveTasksFromBriefJson(params.briefJson);

  if (!tasks.length) {
    return { createdCount: 0 };
  }

  const db = getPrisma();
  const result = await db.waveTask.createMany({
    data: tasks.map((task) => ({
      waveBriefId: params.briefId,
      waveId: params.waveId,
      title: task.title,
      suggestedOwner: task.suggestedOwner ?? undefined,
      sourceDropIdsJson: toInputJson(task.sourceDropIds),
    })),
  });

  await logEvent({
    type: "wave_task.suggested",
    entityType: "wave_brief",
    entityId: params.briefId,
    actor: "admin",
    message: "Suggested wave tasks extracted from a wave brief.",
    metadata: {
      waveId: params.waveId,
      taskCount: result.count,
    },
  });

  return { createdCount: result.count };
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
    },
  });
}

export async function updateWaveTask(params: {
  taskId: string;
  status?: WaveTaskStatus;
  title?: string;
  suggestedOwner?: string;
  reviewerNotes?: string;
  reviewedBy?: string;
}) {
  const db = getPrisma();
  const existing = await db.waveTask.findUnique({ where: { id: params.taskId } });

  if (!existing) {
    throw Object.assign(new Error("Wave task not found."), { status: 404 });
  }

  const data: Prisma.WaveTaskUpdateInput = {
    title: params.title === undefined ? undefined : compactText(params.title, 240),
    suggestedOwner: params.suggestedOwner === undefined ? undefined : compactText(params.suggestedOwner, 120) || null,
    reviewerNotes: params.reviewerNotes,
    reviewedBy: params.reviewedBy,
  };

  if (params.status) {
    data.status = params.status;
    data.completedAt = params.status === "completed" ? new Date() : null;
  }

  const task = await db.waveTask.update({
    where: { id: existing.id },
    data,
  });

  await logEvent({
    type: "wave_task.reviewed",
    entityType: "wave_task",
    entityId: task.id,
    actor: params.reviewedBy ?? "admin",
    message: "Wave task reviewed.",
    metadata: {
      waveId: task.waveId,
      status: task.status,
      previousStatus: existing.status,
      waveBriefId: task.waveBriefId,
    },
  });

  return task;
}
