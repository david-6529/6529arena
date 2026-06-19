import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildWaveTaskOwnerStats,
  buildWaveTaskWaveStats,
  buildWaveTaskWorkflowStats,
  createManualWaveTask,
  createSuggestedTasksForBrief,
  createWaveTaskComment,
  getWaveTaskOwnerStats,
  getWaveTaskOutcomeStats,
  getWaveTaskWaveStats,
  getWaveTaskWorkflowStats,
  updateWaveTask,
} from "@/lib/data/wave-tasks";
import { getPrisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
  prisma: undefined,
}));

vi.mock("@/lib/observability/events", () => ({
  logEvent: vi.fn(),
}));

const waveTask = {
  createMany: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  groupBy: vi.fn(),
  update: vi.fn(),
};

const waveTaskComment = {
  create: vi.fn(),
};

const db = {
  waveTask,
  waveTaskComment,
};

const baseTask = {
  id: "task-1",
  waveBriefId: "brief-1",
  waveId: "wave-1",
  title: "Original task",
  status: "suggested",
  workflowLabel: null,
  suggestedOwner: "agent-suggested-owner",
  assignedTo: null,
  claimedBy: null,
  claimedAt: null,
  lastSeenBriefId: null,
  lastSeenAt: null,
  seenCount: 1,
  sourceDropIdsJson: [],
  reviewerNotes: null,
  outcomeDropId: null,
  outcomeUrl: null,
  outcomeSummary: null,
  outcomeRecordedAt: null,
  outcomeScore: null,
  outcomeScoreNotes: null,
  outcomeReviewedBy: null,
  outcomeReviewedAt: null,
  completedAt: null,
};

beforeEach(() => {
  vi.mocked(getPrisma).mockReturnValue(db as never);
  vi.mocked(logEvent).mockReset();
  waveTask.createMany.mockReset();
  waveTask.create.mockReset();
  waveTask.findMany.mockReset();
  waveTask.findUnique.mockReset();
  waveTask.count.mockReset();
  waveTask.aggregate.mockReset();
  waveTask.groupBy.mockReset();
  waveTask.update.mockReset();
  waveTaskComment.create.mockReset();
  waveTask.createMany.mockImplementation(({ data }) => ({
    count: data.length,
  }));
  waveTask.create.mockImplementation(({ data }) => ({
    ...baseTask,
    ...data,
  }));
  waveTask.findMany.mockResolvedValue([]);
  waveTask.count.mockResolvedValue(0);
  waveTask.aggregate.mockResolvedValue({ _avg: { outcomeScore: null } });
  waveTask.groupBy.mockResolvedValue([]);
  waveTask.update.mockImplementation(({ data }) => ({
    ...baseTask,
    ...data,
  }));
  waveTaskComment.create.mockImplementation(({ data }) => ({
    id: "comment-1",
    ...data,
    createdAt: new Date("2026-06-18T03:00:00.000Z"),
  }));
});

describe("getWaveTaskOutcomeStats", () => {
  it("rolls up completed task outcome scoring", async () => {
    waveTask.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    waveTask.aggregate.mockResolvedValue({
      _avg: {
        outcomeScore: 4.3333333333,
      },
    });
    waveTask.groupBy.mockResolvedValue([
      {
        outcomeScore: 5,
        _count: {
          _all: 2,
        },
      },
      {
        outcomeScore: 3,
        _count: {
          _all: 1,
        },
      },
    ]);

    const stats = await getWaveTaskOutcomeStats();

    expect(stats).toEqual({
      completedCount: 4,
      evidenceCount: 2,
      scoredCount: 3,
      unscoredCompletedCount: 1,
      averageOutcomeScore: 4.3333333333,
      strongOutcomeCount: 2,
      weakOutcomeCount: 0,
      outcomeScoreDistribution: {
        1: 0,
        2: 0,
        3: 1,
        4: 0,
        5: 2,
      },
    });
    expect(waveTask.count).toHaveBeenNthCalledWith(1, {
      where: {
        status: "completed",
      },
    });
    expect(waveTask.count).toHaveBeenNthCalledWith(2, {
      where: {
        status: "completed",
        outcomeScore: {
          not: null,
        },
      },
    });
    expect(waveTask.count).toHaveBeenNthCalledWith(3, {
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
    });
    expect(waveTask.aggregate).toHaveBeenCalledWith({
      where: {
        status: "completed",
        outcomeScore: {
          not: null,
        },
      },
      _avg: {
        outcomeScore: true,
      },
    });
    expect(waveTask.groupBy).toHaveBeenCalledWith({
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
    });
  });
});

describe("buildWaveTaskOwnerStats", () => {
  it("rolls up open load and completed outcome quality by resolved owner", () => {
    const stats = buildWaveTaskOwnerStats(
      [
        {
          status: "in_progress",
          assignedTo: "alice",
          claimedBy: null,
          suggestedOwner: "agent suggestion",
          outcomeDropId: null,
          outcomeUrl: null,
          outcomeSummary: null,
          outcomeScore: null,
        },
        {
          status: "completed",
          assignedTo: "alice",
          claimedBy: null,
          suggestedOwner: null,
          outcomeDropId: "drop-1",
          outcomeUrl: null,
          outcomeSummary: null,
          outcomeScore: 5,
        },
        {
          status: "completed",
          assignedTo: "Alice ",
          claimedBy: null,
          suggestedOwner: null,
          outcomeDropId: null,
          outcomeUrl: null,
          outcomeSummary: null,
          outcomeScore: 2,
        },
        {
          status: "completed",
          assignedTo: "",
          claimedBy: "bob",
          suggestedOwner: null,
          outcomeDropId: null,
          outcomeUrl: "https://example.com/proof",
          outcomeSummary: null,
          outcomeScore: null,
        },
        {
          status: "suggested",
          assignedTo: null,
          claimedBy: null,
          suggestedOwner: null,
          outcomeDropId: null,
          outcomeUrl: null,
          outcomeSummary: null,
          outcomeScore: null,
        },
        {
          status: "rejected",
          assignedTo: "charlie",
          claimedBy: null,
          suggestedOwner: null,
          outcomeDropId: null,
          outcomeUrl: null,
          outcomeSummary: null,
          outcomeScore: 1,
        },
      ],
      3,
    );

    expect(stats).toEqual([
      {
        owner: "alice",
        totalTrackedCount: 3,
        openCount: 1,
        completedCount: 2,
        evidenceCount: 1,
        scoredCount: 2,
        unscoredCompletedCount: 0,
        averageOutcomeScore: 3.5,
        strongOutcomeCount: 1,
        weakOutcomeCount: 1,
      },
      {
        owner: "unassigned",
        totalTrackedCount: 1,
        openCount: 1,
        completedCount: 0,
        evidenceCount: 0,
        scoredCount: 0,
        unscoredCompletedCount: 0,
        averageOutcomeScore: null,
        strongOutcomeCount: 0,
        weakOutcomeCount: 0,
      },
      {
        owner: "bob",
        totalTrackedCount: 1,
        openCount: 0,
        completedCount: 1,
        evidenceCount: 1,
        scoredCount: 0,
        unscoredCompletedCount: 1,
        averageOutcomeScore: null,
        strongOutcomeCount: 0,
        weakOutcomeCount: 0,
      },
    ]);
  });
});

describe("getWaveTaskOwnerStats", () => {
  it("fetches task-owner fields and returns the derived owner rollups", async () => {
    waveTask.findMany.mockResolvedValue([
      {
        status: "completed",
        assignedTo: "ops",
        claimedBy: null,
        suggestedOwner: null,
        outcomeDropId: "drop-1",
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: 4,
      },
    ]);

    const stats = await getWaveTaskOwnerStats();

    expect(stats).toEqual([
      {
        owner: "ops",
        totalTrackedCount: 1,
        openCount: 0,
        completedCount: 1,
        evidenceCount: 1,
        scoredCount: 1,
        unscoredCompletedCount: 0,
        averageOutcomeScore: 4,
        strongOutcomeCount: 1,
        weakOutcomeCount: 0,
      },
    ]);
    expect(waveTask.findMany).toHaveBeenCalledWith({
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
  });
});

describe("buildWaveTaskWaveStats", () => {
  it("rolls up open load, repeated open work, and completed quality by wave", () => {
    const stats = buildWaveTaskWaveStats([
      {
        waveId: "wave-a",
        status: "confirmed",
        seenCount: 3,
        outcomeDropId: null,
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: null,
      },
      {
        waveId: "wave-a",
        status: "in_progress",
        seenCount: 1,
        outcomeDropId: null,
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: null,
      },
      {
        waveId: "wave-a",
        status: "completed",
        seenCount: 2,
        outcomeDropId: null,
        outcomeUrl: null,
        outcomeSummary: "Done, but weak.",
        outcomeScore: 1,
      },
      {
        waveId: "wave-a",
        status: "completed",
        seenCount: 1,
        outcomeDropId: null,
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: null,
      },
      {
        waveId: "wave-b",
        status: "suggested",
        seenCount: 4,
        outcomeDropId: null,
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: null,
      },
      {
        waveId: "wave-b",
        status: "completed",
        seenCount: 1,
        outcomeDropId: "drop-2",
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: 5,
      },
      {
        waveId: "wave-c",
        status: "rejected",
        seenCount: 10,
        outcomeDropId: null,
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: 1,
      },
    ]);

    expect(stats).toEqual([
      {
        waveId: "wave-a",
        totalTrackedCount: 4,
        openCount: 2,
        repeatedOpenCount: 1,
        completedCount: 2,
        evidenceCount: 1,
        scoredCount: 1,
        unscoredCompletedCount: 1,
        averageOutcomeScore: 1,
        strongOutcomeCount: 0,
        weakOutcomeCount: 1,
      },
      {
        waveId: "wave-b",
        totalTrackedCount: 2,
        openCount: 1,
        repeatedOpenCount: 1,
        completedCount: 1,
        evidenceCount: 1,
        scoredCount: 1,
        unscoredCompletedCount: 0,
        averageOutcomeScore: 5,
        strongOutcomeCount: 1,
        weakOutcomeCount: 0,
      },
    ]);
  });
});

describe("getWaveTaskWaveStats", () => {
  it("fetches task wave fields and returns derived wave rollups", async () => {
    waveTask.findMany.mockResolvedValue([
      {
        waveId: "wave-1",
        status: "completed",
        seenCount: 1,
        outcomeDropId: null,
        outcomeUrl: "https://example.com/proof",
        outcomeSummary: null,
        outcomeScore: 4,
      },
    ]);

    const stats = await getWaveTaskWaveStats();

    expect(stats).toEqual([
      {
        waveId: "wave-1",
        totalTrackedCount: 1,
        openCount: 0,
        repeatedOpenCount: 0,
        completedCount: 1,
        evidenceCount: 1,
        scoredCount: 1,
        unscoredCompletedCount: 0,
        averageOutcomeScore: 4,
        strongOutcomeCount: 1,
        weakOutcomeCount: 0,
      },
    ]);
    expect(waveTask.findMany).toHaveBeenCalledWith({
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
  });
});

describe("buildWaveTaskWorkflowStats", () => {
  it("rolls up open load, repeated open work, and completed quality by workflow", () => {
    const stats = buildWaveTaskWorkflowStats([
      {
        workflowLabel: "Grants",
        status: "confirmed",
        seenCount: 2,
        outcomeDropId: null,
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: null,
      },
      {
        workflowLabel: " grants ",
        status: "completed",
        seenCount: 1,
        outcomeDropId: "drop-1",
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: 4,
      },
      {
        workflowLabel: null,
        status: "suggested",
        seenCount: 3,
        outcomeDropId: null,
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: null,
      },
      {
        workflowLabel: null,
        status: "completed",
        seenCount: 1,
        outcomeDropId: null,
        outcomeUrl: null,
        outcomeSummary: "No useful result.",
        outcomeScore: 1,
      },
      {
        workflowLabel: "Governance",
        status: "rejected",
        seenCount: 5,
        outcomeDropId: null,
        outcomeUrl: null,
        outcomeSummary: null,
        outcomeScore: 1,
      },
    ]);

    expect(stats).toEqual([
      {
        workflowLabel: "unclassified",
        totalTrackedCount: 2,
        openCount: 1,
        repeatedOpenCount: 1,
        completedCount: 1,
        evidenceCount: 1,
        scoredCount: 1,
        unscoredCompletedCount: 0,
        averageOutcomeScore: 1,
        strongOutcomeCount: 0,
        weakOutcomeCount: 1,
      },
      {
        workflowLabel: "Grants",
        totalTrackedCount: 2,
        openCount: 1,
        repeatedOpenCount: 1,
        completedCount: 1,
        evidenceCount: 1,
        scoredCount: 1,
        unscoredCompletedCount: 0,
        averageOutcomeScore: 4,
        strongOutcomeCount: 1,
        weakOutcomeCount: 0,
      },
    ]);
  });
});

describe("getWaveTaskWorkflowStats", () => {
  it("fetches task workflow fields and returns derived workflow rollups", async () => {
    waveTask.findMany.mockResolvedValue([
      {
        workflowLabel: "grants",
        status: "completed",
        seenCount: 1,
        outcomeDropId: null,
        outcomeUrl: "https://example.com/proof",
        outcomeSummary: null,
        outcomeScore: 4,
      },
    ]);

    const stats = await getWaveTaskWorkflowStats();

    expect(stats).toEqual([
      {
        workflowLabel: "grants",
        totalTrackedCount: 1,
        openCount: 0,
        repeatedOpenCount: 0,
        completedCount: 1,
        evidenceCount: 1,
        scoredCount: 1,
        unscoredCompletedCount: 0,
        averageOutcomeScore: 4,
        strongOutcomeCount: 1,
        weakOutcomeCount: 0,
      },
    ]);
    expect(waveTask.findMany).toHaveBeenCalledWith({
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
  });
});

function briefJsonWithTasks(tasks: Array<{ task: string; suggested_owner?: string; source_drop_ids?: string[] }>) {
  return {
    title: "Wave summary",
    executive_summary: "Summary",
    action_items: tasks.map((task) => ({
      suggested_owner: "",
      source_drop_ids: [],
      ...task,
    })),
  };
}

describe("createSuggestedTasksForBrief", () => {
  it("creates new suggested tasks with first-seen metadata", async () => {
    const result = await createSuggestedTasksForBrief({
      briefId: "brief-1",
      waveId: "wave-1",
      briefJson: briefJsonWithTasks([
        {
          task: " Confirm grant reviewer ",
          suggested_owner: "ops",
          source_drop_ids: ["drop-1"],
        },
      ]),
    });

    expect(result).toEqual({
      createdCount: 1,
      rementionedCount: 0,
      skippedCount: 0,
    });
    expect(waveTask.findMany).toHaveBeenCalledWith({
      where: {
        waveId: "wave-1",
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
    expect(waveTask.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          waveBriefId: "brief-1",
          lastSeenBriefId: "brief-1",
          lastSeenAt: expect.any(Date),
          seenCount: 1,
          waveId: "wave-1",
          title: "Confirm grant reviewer",
          workflowLabel: "grants",
          suggestedOwner: "ops",
          sourceDropIdsJson: ["drop-1"],
        }),
      ],
    });
    expect(waveTask.update).not.toHaveBeenCalled();
  });

  it("updates repeated open tasks with last-seen metadata instead of creating duplicates", async () => {
    waveTask.findMany.mockResolvedValue([
      {
        id: "task-1",
        title: "Confirm grant reviewer",
        workflowLabel: null,
        sourceDropIdsJson: ["drop-1"],
      },
    ]);

    const result = await createSuggestedTasksForBrief({
      briefId: "brief-2",
      waveId: "wave-1",
      briefJson: briefJsonWithTasks([
        {
          task: "confirm grant reviewer",
          suggested_owner: "ops",
          source_drop_ids: ["drop-2", "drop-1"],
        },
      ]),
    });

    expect(result).toEqual({
      createdCount: 0,
      rementionedCount: 1,
      skippedCount: 0,
    });
    expect(waveTask.createMany).not.toHaveBeenCalled();
    expect(waveTask.update).toHaveBeenCalledWith({
      where: {
        id: "task-1",
      },
      data: expect.objectContaining({
        lastSeenBriefId: "brief-2",
        lastSeenAt: expect.any(Date),
        seenCount: {
          increment: 1,
        },
        workflowLabel: "grants",
        sourceDropIdsJson: ["drop-1", "drop-2"],
      }),
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_task.suggested",
        actor: "operator",
        metadata: expect.objectContaining({
          taskCount: 0,
          rementionedTaskCount: 1,
          skippedTaskCount: 0,
        }),
      }),
    );
  });
});

describe("createManualWaveTask", () => {
  it("infers a workflow label for manual tasks when one is not provided", async () => {
    await createManualWaveTask({
      waveId: "wave-1",
      title: "Prepare governance vote notes",
    });

    expect(waveTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workflowLabel: "governance",
      }),
    });
  });

  it("stores a human assignment separately from the suggested owner", async () => {
    await createManualWaveTask({
      waveId: "wave-1",
      title: " Confirm grant reviewer ",
      workflowLabel: " grants ",
      suggestedOwner: "agent suggestion",
      assignedTo: "alice",
      reviewedBy: "ops",
    });

    expect(waveTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Confirm grant reviewer",
        workflowLabel: "grants",
        suggestedOwner: "agent suggestion",
        assignedTo: "alice",
      }),
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_task.created_manual",
        metadata: expect.objectContaining({
          assignedTo: "alice",
          workflowLabel: "grants",
        }),
      }),
    );
  });
});

describe("updateWaveTask", () => {
  it("updates workflow metadata independently from status and owner fields", async () => {
    waveTask.findUnique.mockResolvedValue(baseTask);

    await updateWaveTask({
      taskId: "task-1",
      workflowLabel: "governance",
      reviewedBy: "ops",
    });

    expect(waveTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        workflowLabel: "governance",
        assignedTo: undefined,
        claimedBy: undefined,
      }),
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_task.reviewed",
        metadata: expect.objectContaining({
          workflowLabel: "governance",
        }),
      }),
    );
  });

  it("assigns and claims a task while preserving the suggested owner", async () => {
    waveTask.findUnique.mockResolvedValue(baseTask);

    await updateWaveTask({
      taskId: "task-1",
      status: "in_progress",
      assignedTo: "alice",
      claimedBy: "alice",
      reviewedBy: "ops",
    });

    expect(waveTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        status: "in_progress",
        suggestedOwner: undefined,
        assignedTo: "alice",
        claimedBy: "alice",
        claimedAt: expect.any(Date),
      }),
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_task.reviewed",
        metadata: expect.objectContaining({
          assignedTo: "alice",
          claimedBy: "alice",
        }),
      }),
    );
  });

  it("does not change claimedAt when an already claimed task is saved again", async () => {
    const claimedAt = new Date("2026-06-18T00:00:00.000Z");
    waveTask.findUnique.mockResolvedValue({
      ...baseTask,
      claimedBy: "alice",
      claimedAt,
    });

    await updateWaveTask({
      taskId: "task-1",
      claimedBy: "alice",
    });

    expect(waveTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        claimedBy: "alice",
        claimedAt,
      }),
    });
  });

  it("refreshes claimedAt when a different claimant takes over", async () => {
    const claimedAt = new Date("2026-06-18T00:00:00.000Z");
    waveTask.findUnique.mockResolvedValue({
      ...baseTask,
      claimedBy: "alice",
      claimedAt,
    });

    await updateWaveTask({
      taskId: "task-1",
      claimedBy: "bob",
    });

    expect(waveTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        claimedBy: "bob",
        claimedAt: expect.any(Date),
      }),
    });
    const claimedAtUpdate = waveTask.update.mock.calls[0]?.[0].data.claimedAt;
    expect(claimedAtUpdate).not.toBe(claimedAt);
  });

  it("clears claim metadata when claimedBy is cleared", async () => {
    waveTask.findUnique.mockResolvedValue({
      ...baseTask,
      claimedBy: "alice",
      claimedAt: new Date("2026-06-18T00:00:00.000Z"),
    });

    await updateWaveTask({
      taskId: "task-1",
      claimedBy: null,
    });

    expect(waveTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        claimedBy: null,
        claimedAt: null,
      }),
    });
  });

  it("records a human outcome score when completed work is reviewed", async () => {
    waveTask.findUnique.mockResolvedValue(baseTask);

    await updateWaveTask({
      taskId: "task-1",
      status: "completed",
      outcomeScore: 5,
      outcomeScoreNotes: "Solved the issue and linked clear evidence.",
      outcomeReviewedBy: "ops",
    });

    expect(waveTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        status: "completed",
        completedAt: expect.any(Date),
        outcomeScore: 5,
        outcomeScoreNotes: "Solved the issue and linked clear evidence.",
        outcomeReviewedBy: "ops",
        outcomeReviewedAt: expect.any(Date),
      }),
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_task.reviewed",
        metadata: expect.objectContaining({
          outcomeScore: 5,
        }),
      }),
    );
  });

  it("rejects invalid outcome scores before updating", async () => {
    waveTask.findUnique.mockResolvedValue(baseTask);

    await expect(
      updateWaveTask({
        taskId: "task-1",
        outcomeScore: 6,
      }),
    ).rejects.toMatchObject({
      message: "Task outcome score must be an integer from 1 to 5.",
      status: 400,
    });

    expect(waveTask.update).not.toHaveBeenCalled();
  });
});

describe("createWaveTaskComment", () => {
  it("stores an append-only task comment and writes an audit event", async () => {
    waveTask.findUnique.mockResolvedValue({
      ...baseTask,
      assignedTo: "alice",
      claimedBy: "alice",
    });

    const comment = await createWaveTaskComment({
      taskId: "task-1",
      body: "  Followed up with the reviewer.  ",
      author: "ops",
    });

    expect(waveTask.findUnique).toHaveBeenCalledWith({
      where: { id: "task-1" },
      select: {
        id: true,
        waveId: true,
        status: true,
        assignedTo: true,
        claimedBy: true,
      },
    });
    expect(waveTaskComment.create).toHaveBeenCalledWith({
      data: {
        taskId: "task-1",
        body: "Followed up with the reviewer.",
        author: "ops",
      },
    });
    expect(comment.id).toBe("comment-1");
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_task.comment_added",
        entityType: "wave_task",
        entityId: "task-1",
        actor: "ops",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          assignedTo: "alice",
          claimedBy: "alice",
          commentId: "comment-1",
        }),
      }),
    );
  });

  it("uses operator as the default actor for anonymous comments", async () => {
    waveTask.findUnique.mockResolvedValue({
      ...baseTask,
      assignedTo: null,
      claimedBy: null,
    });

    await createWaveTaskComment({
      taskId: "task-1",
      body: "No named author.",
    });

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_task.comment_added",
        actor: "operator",
      }),
    );
  });

  it("rejects empty comments before writing", async () => {
    waveTask.findUnique.mockResolvedValue(baseTask);

    await expect(
      createWaveTaskComment({
        taskId: "task-1",
        body: "   ",
      }),
    ).rejects.toMatchObject({
      message: "Task comment cannot be empty.",
      status: 400,
    });

    expect(waveTaskComment.create).not.toHaveBeenCalled();
  });
});
