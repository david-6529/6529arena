import { beforeEach, describe, expect, it, vi } from "vitest";

const { appEvent } = vi.hoisted(() => ({
  appEvent: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appEvent,
  },
}));

vi.mock("@/lib/observability/telemetry", () => ({
  captureTelemetryEvent: vi.fn(),
}));

import { listEventsForEntities } from "@/lib/observability/events";

beforeEach(() => {
  appEvent.findMany.mockReset();
});

describe("listEventsForEntities", () => {
  it("groups recent events by entity and applies a per-entity cap", async () => {
    appEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        type: "wave_brief.approve",
        severity: "info",
        message: "Approved.",
        entityId: "brief-1",
        actor: "alice",
        createdAt: new Date("2026-06-18T02:00:00.000Z"),
      },
      {
        id: "event-2",
        type: "wave_brief.update",
        severity: "info",
        message: "Updated.",
        entityId: "brief-1",
        actor: "alice",
        createdAt: new Date("2026-06-18T01:00:00.000Z"),
      },
      {
        id: "event-3",
        type: "wave_brief.created",
        severity: "info",
        message: "Created.",
        entityId: "brief-1",
        actor: "admin",
        createdAt: new Date("2026-06-18T00:00:00.000Z"),
      },
      {
        id: "event-4",
        type: "wave_brief.created",
        severity: "info",
        message: "Created.",
        entityId: "brief-2",
        actor: "admin",
        createdAt: new Date("2026-06-18T00:30:00.000Z"),
      },
    ]);

    const events = await listEventsForEntities({
      entityType: "wave_brief",
      entityIds: ["brief-1", "brief-2", "brief-1"],
      limitPerEntity: 2,
    });

    expect(appEvent.findMany).toHaveBeenCalledWith({
      where: {
        entityType: "wave_brief",
        entityId: {
          in: ["brief-1", "brief-2"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 16,
      select: {
        id: true,
        type: true,
        severity: true,
        message: true,
        entityId: true,
        actor: true,
        createdAt: true,
      },
    });
    expect(events["brief-1"].map((event) => event.id)).toEqual(["event-1", "event-2"]);
    expect(events["brief-2"].map((event) => event.id)).toEqual(["event-4"]);
  });
});
