import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { runBattle } from "@/lib/data/battle-actions";
import { logEvent } from "@/lib/observability/events";

type BattleRunPayload = {
  agentIds?: string[];
};

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseBattleRunPayload(value: unknown): BattleRunPayload {
  if (!value || typeof value !== "object") {
    return {};
  }

  const payload = value as { agentIds?: unknown };

  return {
    agentIds: Array.isArray(payload.agentIds)
      ? payload.agentIds.filter((id): id is string => typeof id === "string")
      : undefined,
  };
}

function jobLockTimeoutMs() {
  const configured = Number(process.env.JOB_LOCK_TIMEOUT_MS ?? 10 * 60 * 1000);

  return Number.isFinite(configured) && configured > 0 ? configured : 10 * 60 * 1000;
}

export async function enqueueBattleRun(params: { battleId: string; agentIds?: string[] }) {
  const db = getPrisma();
  const battle = await db.battle.findUnique({
    where: { id: params.battleId },
    select: { id: true },
  });

  if (!battle) {
    throw Object.assign(new Error("Battle not found."), { status: 404 });
  }

  const dedupeKey = `battle_run:${battle.id}`;
  const payload = toInputJson({ agentIds: params.agentIds });
  const existing = await db.battleJob.findUnique({ where: { dedupeKey } });

  if (existing && ["pending", "running"].includes(existing.status)) {
    await logEvent({
      type: "job.idempotent_reuse",
      battleId: battle.id,
      entityType: "battle_job",
      entityId: existing.id,
      message: "Reused existing pending/running battle job.",
      metadata: { dedupeKey, status: existing.status },
    });
    return existing;
  }

  const job = await db.battleJob.upsert({
    where: { dedupeKey },
    update: {
      status: "pending",
      payloadJson: payload,
      attempts: 0,
      runAfter: new Date(),
      lockedAt: null,
      lockedBy: null,
      startedAt: null,
      finishedAt: null,
      error: null,
    },
    create: {
      battleId: battle.id,
      dedupeKey,
      type: "battle_run",
      status: "pending",
      payloadJson: payload,
    },
  });

  await logEvent({
    type: "job.enqueued",
    battleId: battle.id,
    entityType: "battle_job",
    entityId: job.id,
    message: "Battle run job enqueued.",
    metadata: { dedupeKey, agentIds: params.agentIds },
  });

  return job;
}

export async function processNextBattleJob(workerId = `worker-${process.pid}`) {
  const db = getPrisma();
  const now = new Date();
  const claimed = await claimNextBattleJob(workerId, now);

  if (!claimed) {
    return { processed: false as const, job: null };
  }

  await logEvent({
    type: "job.started",
    battleId: claimed.battleId,
    entityType: "battle_job",
    entityId: claimed.id,
    message: "Battle job processing started.",
    metadata: { type: claimed.type, attempts: claimed.attempts, workerId },
  });

  try {
    if (claimed.type !== "battle_run") {
      throw new Error(`Unsupported job type: ${claimed.type}`);
    }

    const payload = parseBattleRunPayload(claimed.payloadJson);
    await runBattle({ battleId: claimed.battleId, agentIds: payload.agentIds });

    const completed = await db.battleJob.update({
      where: { id: claimed.id },
      data: {
        status: "completed",
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });

    await logEvent({
      type: "job.completed",
      battleId: claimed.battleId,
      entityType: "battle_job",
      entityId: completed.id,
      message: "Battle job completed.",
      metadata: { attempts: completed.attempts },
    });

    return { processed: true as const, job: completed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status: unknown }).status)
        : undefined;
    const nonRetryable = Boolean(status && status >= 400 && status < 500);
    const exhausted = nonRetryable || claimed.attempts >= claimed.maxAttempts;
    const retryDelayMs = Math.min(15 * 60 * 1000, 2 ** Math.max(0, claimed.attempts - 1) * 60_000);
    const failed = await db.battleJob.update({
      where: { id: claimed.id },
      data: {
        status: exhausted ? "failed" : "pending",
        runAfter: exhausted ? claimed.runAfter : new Date(Date.now() + retryDelayMs),
        finishedAt: exhausted ? new Date() : null,
        lockedAt: null,
        lockedBy: null,
        error: message,
      },
    });

    if (exhausted) {
      await db.battle.update({
        where: { id: claimed.battleId },
        data: { status: "failed" },
      });
    }

    await logEvent({
      type: exhausted ? "job.failed" : "job.retry_scheduled",
      severity: exhausted ? "error" : "warn",
      battleId: claimed.battleId,
      entityType: "battle_job",
      entityId: failed.id,
      message: exhausted ? "Battle job exhausted retries." : "Battle job failed and was scheduled for retry.",
      metadata: {
        attempts: failed.attempts,
        maxAttempts: failed.maxAttempts,
        status,
        nonRetryable,
        nextRunAfter: failed.runAfter,
        error: message,
      },
    });

    return { processed: true as const, job: failed };
  }
}

export async function processBattleJobs(params: { limit?: number; workerId?: string } = {}) {
  const limit = Math.min(Math.max(params.limit ?? 1, 1), 10);
  const results = [];
  await recoverStaleBattleJobs();

  for (let index = 0; index < limit; index += 1) {
    const result = await processNextBattleJob(params.workerId);

    if (!result.processed) {
      break;
    }

    results.push(result.job);
  }

  return results;
}

async function claimNextBattleJob(workerId: string, now: Date) {
  const db = getPrisma();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const job = await db.battleJob.findFirst({
      where: {
        status: "pending",
        runAfter: { lte: now },
      },
      orderBy: [{ runAfter: "asc" }, { createdAt: "asc" }],
    });

    if (!job) {
      return null;
    }

    const claimed = await db.battleJob.updateMany({
      where: {
        id: job.id,
        status: "pending",
        runAfter: { lte: now },
      },
      data: {
        status: "running",
        attempts: { increment: 1 },
        lockedAt: now,
        lockedBy: workerId,
        startedAt: now,
        error: null,
      },
    });

    if (claimed.count) {
      return db.battleJob.findUniqueOrThrow({ where: { id: job.id } });
    }
  }

  return null;
}

export async function recoverStaleBattleJobs() {
  const db = getPrisma();
  const staleBefore = new Date(Date.now() - jobLockTimeoutMs());
  const recovered = await db.battleJob.updateMany({
    where: {
      status: "running",
      lockedAt: {
        lt: staleBefore,
      },
    },
    data: {
      status: "pending",
      runAfter: new Date(),
      lockedAt: null,
      lockedBy: null,
      error: "Recovered stale job lock.",
    },
  });

  if (recovered.count) {
    await logEvent({
      type: "job.stale_locks_recovered",
      severity: "warn",
      message: "Recovered stale running jobs back to pending.",
      metadata: { count: recovered.count, staleBefore },
    });
  }

  return recovered.count;
}

export async function cleanupOldBattleJobs() {
  const db = getPrisma();
  const retentionDays = Number(process.env.BATTLE_JOB_RETENTION_DAYS ?? 14);
  const days = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 14;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await db.battleJob.deleteMany({
    where: {
      status: {
        in: ["completed", "failed"],
      },
      finishedAt: {
        lt: cutoff,
      },
    },
  });

  return deleted.count;
}
