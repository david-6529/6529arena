import { Prisma } from "@/generated/prisma/client";
import { postDrop } from "@/lib/6529/client";
import { fetchWaveContext } from "@/lib/6529/wave-context";
import { renderWaveBriefPost } from "@/lib/briefs/render";
import { runWaveBrief } from "@/lib/briefs/runBrief";
import { validateWaveBriefContentSources } from "@/lib/briefs/source-validation";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { createSuggestedTasksForBrief } from "@/lib/data/wave-tasks";
import { logEvent } from "@/lib/observability/events";

const reviewedWaveBriefStatuses = ["approved", "posted", "rejected"];

function isWaveBriefContentLockedStatus(status: string) {
  return status === "posted" || status === "rejected" || status === "posting";
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getErrorStatus(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status: unknown }).status)
      : undefined;

  return Number.isFinite(status) ? status : undefined;
}

export async function listWaveBriefs(limit = 50) {
  if (!prisma) {
    return [];
  }

  return prisma.waveBrief.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      previousBrief: {
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

export async function getWaveBrief(briefId: string) {
  const db = getPrisma();

  return db.waveBrief.findUnique({
    where: { id: briefId },
  });
}

export async function getWaveBriefByTrigger(params: {
  waveId: string;
  triggerDropId: string;
}) {
  const db = getPrisma();

  return db.waveBrief.findFirst({
    where: {
      waveId: params.waveId,
      triggerDropId: params.triggerDropId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getWaveBriefReviewStats() {
  let db = prisma;
  const zeroStats = {
    totalCount: 0,
    reviewedCount: 0,
    scoredCount: 0,
    unscoredReviewedCount: 0,
    postedCount: 0,
    averageHumanScore: null as number | null,
  };

  if (!db) {
    try {
      db = getPrisma();
    } catch {
      return zeroStats;
    }
  }

  if (!db) {
    return zeroStats;
  }

  const [totalCount, reviewedCount, scoredCount, postedCount, scoreAggregate] = await Promise.all([
    db.waveBrief.count(),
    db.waveBrief.count({
      where: {
        status: {
          in: reviewedWaveBriefStatuses,
        },
      },
    }),
    db.waveBrief.count({
      where: {
        status: {
          in: reviewedWaveBriefStatuses,
        },
        humanScore: {
          not: null,
        },
      },
    }),
    db.waveBrief.count({
      where: {
        status: "posted",
      },
    }),
    db.waveBrief.aggregate({
      where: {
        status: {
          in: reviewedWaveBriefStatuses,
        },
        humanScore: {
          not: null,
        },
      },
      _avg: {
        humanScore: true,
      },
    }),
  ]);

  return {
    totalCount,
    reviewedCount,
    scoredCount,
    unscoredReviewedCount: Math.max(reviewedCount - scoredCount, 0),
    postedCount,
    averageHumanScore: scoreAggregate._avg.humanScore,
  };
}

export async function getWaveBriefCostStats() {
  let db = prisma;
  const zeroStats = {
    costedCount: 0,
    totalCostUsd: 0,
    averageCostUsd: null as number | null,
    maxCostUsd: null as number | null,
    averageLatencyMs: null as number | null,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
  };

  if (!db) {
    try {
      db = getPrisma();
    } catch {
      return zeroStats;
    }
  }

  if (!db) {
    return zeroStats;
  }

  const [costedCount, aggregate] = await Promise.all([
    db.waveBrief.count({
      where: {
        costUsd: {
          not: null,
        },
      },
    }),
    db.waveBrief.aggregate({
      where: {
        costUsd: {
          not: null,
        },
      },
      _sum: {
        costUsd: true,
        promptTokens: true,
        completionTokens: true,
      },
      _avg: {
        costUsd: true,
        latencyMs: true,
      },
      _max: {
        costUsd: true,
      },
    }),
  ]);

  return {
    costedCount,
    totalCostUsd: aggregate._sum.costUsd ?? 0,
    averageCostUsd: aggregate._avg.costUsd,
    maxCostUsd: aggregate._max.costUsd,
    averageLatencyMs: aggregate._avg.latencyMs,
    totalPromptTokens: aggregate._sum.promptTokens ?? 0,
    totalCompletionTokens: aggregate._sum.completionTokens ?? 0,
  };
}

export async function createWaveBriefDraft(params: {
  waveId: string;
  triggerDropId?: string;
  requestText?: string;
  contextFrom?: string;
  contextTo?: string;
  maxMessages?: number;
  relatedWaves?: Array<{
    waveId: string;
    label?: string;
  }>;
  provider?: string;
  modelName?: string;
}) {
  const db = getPrisma();
  const requestText = params.requestText || "Create a clear catch-up summary for this 6529 wave.";
  const waveContext = await fetchWaveContext({
    waveId: params.waveId,
    contextFrom: params.contextFrom,
    contextTo: params.contextTo,
    maxMessages: params.maxMessages,
    relatedWaves: params.relatedWaves,
  });

  if (!waveContext.drops.length) {
    throw Object.assign(new Error("No 6529 drops found for the selected wave context."), {
      status: 422,
    });
  }

  const previousBrief = await db.waveBrief.findFirst({
    where: {
      waveId: params.waveId,
      status: {
        in: ["approved", "posted"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      postDropId: true,
      createdAt: true,
    },
  });
  let run: Awaited<ReturnType<typeof runWaveBrief>>;

  try {
    run = await runWaveBrief({
      waveId: params.waveId,
      requestText,
      drops: waveContext.drops,
      provider: params.provider,
      modelName: params.modelName,
      previousSummary: previousBrief ?? undefined,
    });
  } catch (error) {
    await logEvent({
      type: "wave_brief.generation_rejected",
      severity: "warn",
      entityType: "wave",
      entityId: params.waveId,
      actor: "operator",
      message: "Wave summary generation was rejected before draft creation.",
      metadata: {
        waveId: params.waveId,
        requestedProvider: params.provider ?? process.env.WAVE_BRIEF_PROVIDER ?? "openai",
        requestedModel: params.modelName ?? process.env.WAVE_BRIEF_MODEL ?? null,
        previousBriefId: previousBrief?.id,
        status: getErrorStatus(error),
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }

  const brief = await db.waveBrief.create({
    data: {
      previousBriefId: previousBrief?.id,
      waveId: params.waveId,
      triggerDropId: params.triggerDropId,
      status: "draft",
      title: run.structured.title,
      requestText,
      contextJson: toInputJson({
        wave: waveContext.wave ?? null,
        relatedWaves: waveContext.relatedWaves ?? [],
        context: waveContext.context,
      }),
      dropsJson: toInputJson({
        drops: waveContext.drops,
      }),
      briefJson: toInputJson(run.structured),
      content: run.renderedOutput,
      provider: run.provider,
      modelName: run.modelName,
      promptTokens: run.promptTokens,
      completionTokens: run.completionTokens,
      costUsd: run.costUsd,
      latencyMs: run.latencyMs,
    },
  });
  const suggestedTasks = await createSuggestedTasksForBrief({
    briefId: brief.id,
    waveId: brief.waveId,
    briefJson: run.structured,
  });

  await logEvent({
    type: "wave_brief.created",
    entityType: "wave_brief",
    entityId: brief.id,
    actor: "operator",
    message: "Wave summary draft generated from 6529 wave context.",
    metadata: {
      waveId: brief.waveId,
      provider: brief.provider,
      modelName: brief.modelName,
      previousBriefId: brief.previousBriefId,
      dropCount: waveContext.drops.length,
      relatedWaveCount: params.relatedWaves?.length ?? 0,
      suggestedTaskCount: suggestedTasks.createdCount,
      rementionedSuggestedTaskCount: suggestedTasks.rementionedCount,
      skippedSuggestedTaskCount: suggestedTasks.skippedCount,
      context: waveContext.context,
      costUsd: brief.costUsd,
      latencyMs: brief.latencyMs,
    },
  });

  return brief;
}

export async function reviewWaveBrief(params: {
  briefId: string;
  action: "approve" | "reject" | "update";
  title?: string;
  content?: string;
  reviewerNotes?: string | null;
  humanScore?: number | null;
  humanScoreNotes?: string | null;
  reviewedBy?: string;
}) {
  const db = getPrisma();
  const existing = await db.waveBrief.findUnique({ where: { id: params.briefId } });

  if (!existing) {
    throw Object.assign(new Error("Wave summary not found."), { status: 404 });
  }

  if (existing.status === "posted" && params.action !== "update") {
    throw Object.assign(new Error("Posted summaries cannot be approved or rejected again."), { status: 409 });
  }

  if (existing.status === "rejected" && params.action !== "update") {
    throw Object.assign(new Error("Rejected summaries cannot be approved or rejected again. Create a new summary for revisions."), {
      status: 409,
    });
  }

  if (existing.status === "posting" && params.action !== "update") {
    throw Object.assign(new Error("Posting summaries cannot be approved or rejected while the 6529 post is in progress."), {
      status: 409,
    });
  }

  const lockedContentChanged =
    isWaveBriefContentLockedStatus(existing.status) &&
    ((params.title !== undefined && params.title !== existing.title) ||
      (params.content !== undefined && params.content !== existing.content));

  if (lockedContentChanged) {
    if (existing.status === "posted") {
      throw Object.assign(new Error("Posted summaries cannot change title or content. Create a new summary for public revisions."), {
        status: 409,
      });
    }

    if (existing.status === "posting") {
      throw Object.assign(new Error("Posting summaries cannot change title or content while the 6529 post is in progress."), {
        status: 409,
      });
    }

    throw Object.assign(new Error("Rejected summaries cannot change title or content. Create a new summary for revisions."), {
      status: 409,
    });
  }

  const now = new Date();
  const nextContent = params.content ?? existing.content;
  const contentChanged =
    (params.title !== undefined && params.title !== existing.title) ||
    (params.content !== undefined && params.content !== existing.content);
  const approvalInvalidated = params.action === "update" && existing.status === "approved" && contentChanged;
  const data: Prisma.WaveBriefUpdateInput = {
    title: params.title ?? existing.title,
    content: nextContent,
    reviewerNotes: params.reviewerNotes,
    reviewedBy: params.reviewedBy,
  };

  if (params.humanScore !== undefined) {
    data.humanScore = params.humanScore;
  }

  if (params.humanScoreNotes !== undefined) {
    data.humanScoreNotes = params.humanScoreNotes;
  }

  if (params.action === "approve") {
    const sourceCheck = validateWaveBriefContentSources(nextContent, existing.dropsJson);

    if (sourceCheck.missingReferences.length) {
      await logEvent({
        type: "wave_brief.approve_blocked",
        severity: "warn",
        entityType: "wave_brief",
        entityId: existing.id,
        actor: params.reviewedBy ?? "operator",
        message: "Blocked wave summary approval because the final summary content cites drops outside stored context.",
        metadata: {
          waveId: existing.waveId,
          missingDropIds: sourceCheck.missingDropIds,
          missingReferences: sourceCheck.missingReferences,
        },
      });
      throw Object.assign(
        new Error(
          `Cannot approve summary because ${sourceCheck.missingDropIds.length} cited source drop${
            sourceCheck.missingDropIds.length === 1 ? " is" : "s are"
          } missing from the stored wave context.`,
        ),
        { status: 422 },
      );
    }

    data.status = "approved";
    data.approvedAt = now;
    data.rejectedAt = null;
  } else if (params.action === "reject") {
    data.status = "rejected";
    data.approvedAt = null;
    data.rejectedAt = now;
  } else if (approvalInvalidated) {
    data.status = "draft";
    data.approvedAt = null;
    data.rejectedAt = null;
  }

  const brief = await db.waveBrief.update({
    where: { id: existing.id },
    data,
  });

  await logEvent({
    type: `wave_brief.${params.action}`,
    entityType: "wave_brief",
    entityId: brief.id,
    actor: params.reviewedBy ?? "operator",
    message: `Wave summary ${params.action}.`,
    metadata: {
      waveId: brief.waveId,
      status: brief.status,
      humanScore: brief.humanScore,
      previousStatus: existing.status,
      approvalInvalidated,
    },
  });

  return brief;
}

export async function previewWaveBriefPost(params: {
  briefId: string;
  appUrl: string;
}) {
  const brief = await getWaveBrief(params.briefId);

  if (!brief) {
    throw Object.assign(new Error("Wave summary not found."), { status: 404 });
  }

  if (brief.status === "rejected") {
    throw Object.assign(new Error("Rejected summaries cannot be posted."), { status: 409 });
  }

  return buildWaveBriefPostPreview({
    appUrl: params.appUrl,
    brief,
  });
}

export async function postWaveBriefTo6529(params: {
  briefId: string;
  appUrl: string;
}) {
  const db = getPrisma();
  const brief = await db.waveBrief.findUnique({ where: { id: params.briefId } });

  if (!brief) {
    throw Object.assign(new Error("Wave summary not found."), { status: 404 });
  }

  if (brief.status === "rejected") {
    throw Object.assign(new Error("Rejected summaries cannot be posted."), { status: 409 });
  }

  if (brief.status === "posting") {
    throw Object.assign(new Error("A 6529 post is already in progress for this summary."), { status: 409 });
  }

  if (brief.status !== "approved" && brief.status !== "posted") {
    throw Object.assign(new Error("Approve the summary before posting it to 6529."), { status: 422 });
  }

  if (brief.postDropId) {
    await logEvent({
      type: "wave_brief.post_idempotent_reuse",
      entityType: "wave_brief",
      entityId: brief.id,
      message: "Skipped 6529 post because wave summary was already posted.",
      metadata: { postDropId: brief.postDropId },
    });
    return brief;
  }

  const sourceCheck = validateWaveBriefContentSources(brief.content, brief.dropsJson);

  if (sourceCheck.missingReferences.length) {
    await logEvent({
      type: "wave_brief.post_blocked",
      severity: "warn",
      entityType: "wave_brief",
      entityId: brief.id,
      actor: "operator",
      message: "Blocked 6529 post because the final summary content cites drops outside stored context.",
      metadata: {
        waveId: brief.waveId,
        missingDropIds: sourceCheck.missingDropIds,
        missingReferences: sourceCheck.missingReferences,
      },
    });
    throw Object.assign(
      new Error(
        `Cannot post summary because ${sourceCheck.missingDropIds.length} cited source drop${
          sourceCheck.missingDropIds.length === 1 ? " is" : "s are"
        } missing from the stored wave context.`,
      ),
      { status: 422 },
    );
  }

  const claimed = await db.waveBrief.updateMany({
    where: {
      id: brief.id,
      status: "approved",
      postDropId: null,
    },
    data: {
      status: "posting",
    },
  });

  if (!claimed.count) {
    const current = await db.waveBrief.findUnique({ where: { id: brief.id } });

    if (current?.postDropId) {
      await logEvent({
        type: "wave_brief.post_idempotent_reuse",
        entityType: "wave_brief",
        entityId: current.id,
        message: "Skipped 6529 post because wave summary was already posted.",
        metadata: { postDropId: current.postDropId },
      });
      return current;
    }

    if (current?.status === "posting") {
      throw Object.assign(new Error("A 6529 post is already in progress for this summary."), { status: 409 });
    }

    throw Object.assign(new Error("Approve the summary before posting it to 6529."), { status: 422 });
  }

  const preview = buildWaveBriefPostPreview({
    appUrl: params.appUrl,
    brief: {
      ...brief,
      status: "posting",
    },
  });
  let postDropId: string | undefined;

  try {
    const post = await postDrop(brief.waveId, preview.content, {
      replyToDropId: brief.triggerDropId ?? undefined,
    });
    postDropId = typeof post === "object" && post !== null && "id" in post ? String(post.id) : undefined;

    if (!postDropId) {
      throw Object.assign(new Error("6529 post response did not include a drop id."), { status: 502 });
    }

    const updated = await db.waveBrief.update({
      where: { id: brief.id },
      data: {
        status: "posted",
        postedAt: new Date(),
        postDropId,
      },
    });

    await logEvent({
      type: "wave_brief.posted_to_6529",
      entityType: "wave_brief",
      entityId: updated.id,
      message: "Wave summary posted to 6529.",
      metadata: {
        waveId: updated.waveId,
        postDropId: updated.postDropId,
      },
    });

    return updated;
  } catch (error) {
    if (!postDropId) {
      await db.waveBrief.updateMany({
        where: {
          id: brief.id,
          status: "posting",
          postDropId: null,
        },
        data: {
          status: "approved",
        },
      });
    }

    await logEvent({
      type: "wave_brief.post_failed",
      severity: "error",
      entityType: "wave_brief",
      entityId: brief.id,
      actor: "operator",
      message: "Wave summary post to 6529 failed.",
      metadata: {
        waveId: brief.waveId,
        postDropId,
        contentLength: preview.contentLength,
        status: getErrorStatus(error),
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

function buildWaveBriefPostPreview(params: {
  appUrl: string;
  brief: {
    id: string;
    waveId: string;
    status: string;
    postDropId: string | null;
    content: string;
    dropsJson: unknown;
  };
}) {
  const content = renderWaveBriefPost({
    appUrl: params.appUrl,
    briefId: params.brief.id,
    content: params.brief.content,
  });
  const sourceCheck = validateWaveBriefContentSources(params.brief.content, params.brief.dropsJson);

  return {
    briefId: params.brief.id,
    waveId: params.brief.waveId,
    status: params.brief.status,
    postDropId: params.brief.postDropId,
    content,
    contentLength: content.length,
    sourceCheck,
  };
}
