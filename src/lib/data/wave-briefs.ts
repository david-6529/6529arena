import { Prisma } from "@/generated/prisma/client";
import { postDrop } from "@/lib/6529/client";
import { fetchWaveContext } from "@/lib/6529/wave-context";
import { renderWaveBriefPost } from "@/lib/briefs/render";
import { runWaveBrief } from "@/lib/briefs/runBrief";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function listWaveBriefs(limit = 50) {
  if (!prisma) {
    return [];
  }

  return prisma.waveBrief.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
  });
}

export async function getWaveBrief(briefId: string) {
  const db = getPrisma();

  return db.waveBrief.findUnique({
    where: { id: briefId },
  });
}

export async function createWaveBriefDraft(params: {
  waveId: string;
  triggerDropId?: string;
  requestText?: string;
  contextFrom?: string;
  contextTo?: string;
  maxMessages?: number;
  provider?: string;
  modelName?: string;
}) {
  const db = getPrisma();
  const requestText = params.requestText || "Create an operator-ready brief for this 6529 wave.";
  const waveContext = await fetchWaveContext({
    waveId: params.waveId,
    contextFrom: params.contextFrom,
    contextTo: params.contextTo,
    maxMessages: params.maxMessages,
  });

  if (!waveContext.drops.length) {
    throw Object.assign(new Error("No 6529 drops found for the selected wave context."), {
      status: 422,
    });
  }

  const run = await runWaveBrief({
    waveId: params.waveId,
    requestText,
    drops: waveContext.drops,
    provider: params.provider,
    modelName: params.modelName,
  });
  const brief = await db.waveBrief.create({
    data: {
      waveId: params.waveId,
      triggerDropId: params.triggerDropId,
      status: "draft",
      title: run.structured.title,
      requestText,
      contextJson: toInputJson({
        wave: waveContext.wave ?? null,
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

  await logEvent({
    type: "wave_brief.created",
    entityType: "wave_brief",
    entityId: brief.id,
    actor: "admin",
    message: "Wave brief draft generated from 6529 wave context.",
    metadata: {
      waveId: brief.waveId,
      provider: brief.provider,
      modelName: brief.modelName,
      dropCount: waveContext.drops.length,
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
  reviewerNotes?: string;
  reviewedBy?: string;
}) {
  const db = getPrisma();
  const existing = await db.waveBrief.findUnique({ where: { id: params.briefId } });

  if (!existing) {
    throw Object.assign(new Error("Wave brief not found."), { status: 404 });
  }

  if (existing.status === "posted" && params.action !== "update") {
    throw Object.assign(new Error("Posted briefs cannot be approved or rejected again."), { status: 409 });
  }

  const now = new Date();
  const data: Prisma.WaveBriefUpdateInput = {
    title: params.title ?? existing.title,
    content: params.content ?? existing.content,
    reviewerNotes: params.reviewerNotes,
    reviewedBy: params.reviewedBy,
  };

  if (params.action === "approve") {
    data.status = "approved";
    data.approvedAt = now;
    data.rejectedAt = null;
  } else if (params.action === "reject") {
    data.status = "rejected";
    data.rejectedAt = now;
  }

  const brief = await db.waveBrief.update({
    where: { id: existing.id },
    data,
  });

  await logEvent({
    type: `wave_brief.${params.action}`,
    entityType: "wave_brief",
    entityId: brief.id,
    actor: params.reviewedBy ?? "admin",
    message: `Wave brief ${params.action}.`,
    metadata: {
      waveId: brief.waveId,
      status: brief.status,
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
    throw Object.assign(new Error("Wave brief not found."), { status: 404 });
  }

  if (brief.status === "rejected") {
    throw Object.assign(new Error("Rejected briefs cannot be posted."), { status: 409 });
  }

  const content = renderWaveBriefPost({
    appUrl: params.appUrl,
    briefId: brief.id,
    content: brief.content,
  });

  return {
    briefId: brief.id,
    waveId: brief.waveId,
    status: brief.status,
    postDropId: brief.postDropId,
    content,
    contentLength: content.length,
  };
}

export async function postWaveBriefTo6529(params: {
  briefId: string;
  appUrl: string;
}) {
  const db = getPrisma();
  const brief = await db.waveBrief.findUnique({ where: { id: params.briefId } });

  if (!brief) {
    throw Object.assign(new Error("Wave brief not found."), { status: 404 });
  }

  if (brief.status === "rejected") {
    throw Object.assign(new Error("Rejected briefs cannot be posted."), { status: 409 });
  }

  if (brief.status !== "approved" && brief.status !== "posted") {
    throw Object.assign(new Error("Approve the brief before posting it to 6529."), { status: 422 });
  }

  if (brief.postDropId) {
    await logEvent({
      type: "wave_brief.post_idempotent_reuse",
      entityType: "wave_brief",
      entityId: brief.id,
      message: "Skipped 6529 post because wave brief was already posted.",
      metadata: { postDropId: brief.postDropId },
    });
    return brief;
  }

  const preview = await previewWaveBriefPost({
    briefId: brief.id,
    appUrl: params.appUrl,
  });
  const post = await postDrop(brief.waveId, preview.content, {
    replyToDropId: brief.triggerDropId ?? undefined,
  });
  const updated = await db.waveBrief.update({
    where: { id: brief.id },
    data: {
      status: "posted",
      postedAt: new Date(),
      postDropId: typeof post === "object" && post !== null && "id" in post ? String(post.id) : undefined,
    },
  });

  await logEvent({
    type: "wave_brief.posted_to_6529",
    entityType: "wave_brief",
    entityId: updated.id,
    message: "Wave brief posted to 6529.",
    metadata: {
      waveId: updated.waveId,
      postDropId: updated.postDropId,
    },
  });

  return updated;
}
