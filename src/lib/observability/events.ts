import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { captureTelemetryEvent } from "@/lib/observability/telemetry";

type EventSeverity = "debug" | "info" | "warn" | "error";

type LogEventInput = {
  type: string;
  severity?: EventSeverity;
  message?: string;
  entityType?: string;
  entityId?: string;
  battleId?: string;
  actor?: string;
  metadata?: unknown;
};

function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function logEvent(input: LogEventInput) {
  if (!prisma) {
    return;
  }

  try {
    await prisma.appEvent.create({
      data: {
        type: input.type,
        severity: input.severity ?? "info",
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
        battleId: input.battleId,
        actor: input.actor,
        metadata: toInputJson(input.metadata),
      },
    });
    void captureTelemetryEvent(input.type, {
      severity: input.severity ?? "info",
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      battleId: input.battleId,
      metadata: input.metadata,
    }, input.actor ?? "server");
  } catch (error) {
    console.error("Failed to write app event", error);
  }
}

export async function listRecentEvents(limit = 30) {
  if (!prisma) {
    return [];
  }

  return prisma.appEvent.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
  });
}

export async function cleanupOldEvents() {
  if (!prisma) {
    return 0;
  }

  const retentionDays = Number(process.env.APP_EVENT_RETENTION_DAYS ?? 30);
  const days = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await prisma.appEvent.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },
  });

  return deleted.count;
}
