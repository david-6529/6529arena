import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getPrisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

vi.mock("@/lib/data/queries", () => ({
  getLeaderboard: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@/lib/observability/events", () => ({
  logEvent: vi.fn(),
}));

vi.mock("@/lib/observability/telemetry", () => ({
  captureTelemetryException: vi.fn(),
}));

const originalEnv = { ...process.env };

const db = {
  waveBrief: {
    findMany: vi.fn(),
  },
  waveTask: {
    findMany: vi.fn(),
  },
};

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

function exportRequest(type: string) {
  delete process.env.ADMIN_API_KEY;
  process.env.RATE_LIMIT_SALT = "test-salt";

  return new Request(`https://arena.example/api/admin/export?type=${type}&limit=50`, {
    headers: {
      "user-agent": "vitest",
      "x-forwarded-for": "203.0.113.1",
    },
  });
}

describe("GET /api/admin/export", () => {
  it("exports wave summary metadata without raw summary content or source JSON", async () => {
    vi.mocked(getPrisma).mockReturnValue(db as never);
    db.waveBrief.findMany.mockResolvedValue([
      {
        id: "brief-1",
        previousBriefId: "brief-0",
        waveId: "wave-1",
        triggerDropId: "drop-trigger",
        status: "approved",
        title: "Summary title",
        requestText: "private prompt text",
        contextJson: { private: "context" },
        dropsJson: { drops: [{ id: "drop-1", content: "raw wave text" }] },
        briefJson: {
          executive_summary: "raw generated json",
          decisions_needed: [{ source_drop_ids: ["drop-1", "missing-structured"] }],
        },
        content: "**Decisions needed**\n- Pick an owner. Sources: drop-1, missing-final",
        provider: "openai",
        modelName: "gpt-4.1-mini",
        promptTokens: 1200,
        completionTokens: 300,
        costUsd: 0.04,
        latencyMs: 1500,
        humanScore: 4,
        reviewedBy: "ops",
        approvedAt: new Date("2026-06-18T01:00:00.000Z"),
        rejectedAt: null,
        postDropId: null,
        postedAt: null,
        createdAt: new Date("2026-06-18T00:00:00.000Z"),
        updatedAt: new Date("2026-06-18T01:30:00.000Z"),
        _count: {
          tasks: 2,
        },
      },
    ]);

    const response = await GET(exportRequest("wave-summaries"));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("swarmops-wave-summaries.csv");
    expect(csv).toContain("summary_id,wave_id,previous_summary_id");
    expect(csv).toContain("brief-1,wave-1,brief-0");
    expect(csv).toContain("Summary title");
    expect(csv).toContain("openai,gpt-4.1-mini");
    expect(csv).toContain("structured_source_references,structured_missing_sources,final_source_references,final_missing_sources,final_source_gate");
    expect(csv).toContain("2,1,2,1,blocked");
    expect(csv).not.toContain("private prompt text");
    expect(csv).not.toContain("raw wave text");
    expect(csv).not.toContain("Pick an owner");
    expect(csv).not.toContain("missing-final");
    expect(csv).not.toContain("raw generated json");
    expect(csv).not.toContain("missing-structured");
    expect(db.waveBrief.findMany).toHaveBeenCalledWith({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "admin.csv_exported",
        metadata: expect.objectContaining({
          exportType: "wave-summaries",
          count: 1,
          filename: "swarmops-wave-summaries.csv",
        }),
      }),
    );
  });

  it("exports wave task operational metadata without notes, comments, or outcome summaries", async () => {
    vi.mocked(getPrisma).mockReturnValue(db as never);
    db.waveTask.findMany.mockResolvedValue([
      {
        id: "task-1",
        waveBriefId: "brief-1",
        waveId: "wave-1",
        title: "Verify cited claim",
        status: "completed",
        workflowLabel: "grants",
        suggestedOwner: "agent",
        assignedTo: "alice",
        claimedBy: "alice",
        claimedAt: new Date("2026-06-18T02:00:00.000Z"),
        lastSeenBriefId: "brief-2",
        lastSeenAt: new Date("2026-06-18T03:00:00.000Z"),
        seenCount: 2,
        sourceDropIdsJson: ["drop-1", "drop-2"],
        reviewerNotes: "private reviewer note",
        reviewedBy: "ops",
        outcomeDropId: "drop-outcome",
        outcomeUrl: "https://example.com/evidence",
        outcomeSummary: "private outcome summary",
        outcomeRecordedAt: new Date("2026-06-18T04:00:00.000Z"),
        outcomeScore: 5,
        outcomeScoreNotes: "private score note",
        outcomeReviewedBy: "ops",
        outcomeReviewedAt: new Date("2026-06-18T05:00:00.000Z"),
        completedAt: new Date("2026-06-18T06:00:00.000Z"),
        createdAt: new Date("2026-06-18T01:00:00.000Z"),
        updatedAt: new Date("2026-06-18T07:00:00.000Z"),
        _count: {
          comments: 3,
        },
      },
    ]);

    const response = await GET(exportRequest("wave-tasks"));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("swarmops-wave-tasks.csv");
    expect(csv).toContain("task_id,summary_id,wave_id,title,status,workflow");
    expect(csv).toContain("task-1,brief-1,wave-1,Verify cited claim,completed,grants");
    expect(csv).toContain("drop-1 drop-2");
    expect(csv).toContain("drop-outcome,https://example.com/evidence");
    expect(csv).not.toContain("private reviewer note");
    expect(csv).not.toContain("private outcome summary");
    expect(csv).not.toContain("private score note");
    expect(db.waveTask.findMany).toHaveBeenCalledWith({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });
  });
});
