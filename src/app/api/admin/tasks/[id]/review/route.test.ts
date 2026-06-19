import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { updateWaveTask } from "@/lib/data/wave-tasks";

vi.mock("@/lib/data/wave-tasks", () => ({
  updateWaveTask: vi.fn(),
  waveTaskStatuses: ["suggested", "confirmed", "in_progress", "completed", "rejected"],
}));

vi.mock("@/lib/observability/events", () => ({
  logEvent: vi.fn(),
}));

vi.mock("@/lib/observability/telemetry", () => ({
  captureTelemetryException: vi.fn(),
}));

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

function reviewRequest(body: unknown) {
  delete process.env.ADMIN_API_KEY;

  return new Request("https://arena.example/api/admin/tasks/task-1/review", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function params(id = "task-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/tasks/:id/review", () => {
  it("passes assignment and claim fields to the task service", async () => {
    vi.mocked(updateWaveTask).mockResolvedValue({
      id: "task-1",
      assignedTo: "alice",
      claimedBy: "alice",
    } as never);

    const response = await POST(
      reviewRequest({
        status: "in_progress",
        title: "Check source claims",
        workflowLabel: "grants",
        suggestedOwner: "agent suggestion",
        assignedTo: "alice",
        claimedBy: "alice",
        reviewerNotes: null,
        reviewedBy: "ops",
      }),
      params(),
    );

    await expect(response.json()).resolves.toEqual({
      task: {
        id: "task-1",
        assignedTo: "alice",
        claimedBy: "alice",
      },
    });
    expect(updateWaveTask).toHaveBeenCalledWith({
      taskId: "task-1",
      status: "in_progress",
      title: "Check source claims",
      workflowLabel: "grants",
      suggestedOwner: "agent suggestion",
      assignedTo: "alice",
      claimedBy: "alice",
      reviewerNotes: null,
      reviewedBy: "ops",
    });
  });

  it("passes outcome review fields to the task service", async () => {
    vi.mocked(updateWaveTask).mockResolvedValue({
      id: "task-1",
      outcomeScore: 5,
      outcomeScoreNotes: "Useful result.",
      outcomeReviewedBy: "ops",
    } as never);

    const response = await POST(
      reviewRequest({
        status: "completed",
        outcomeScore: 5,
        outcomeScoreNotes: "Useful result.",
        outcomeReviewedBy: "ops",
      }),
      params(),
    );

    await expect(response.json()).resolves.toEqual({
      task: {
        id: "task-1",
        outcomeScore: 5,
        outcomeScoreNotes: "Useful result.",
        outcomeReviewedBy: "ops",
      },
    });
    expect(updateWaveTask).toHaveBeenCalledWith({
      taskId: "task-1",
      status: "completed",
      outcomeScore: 5,
      outcomeScoreNotes: "Useful result.",
      outcomeReviewedBy: "ops",
    });
  });

  it("rejects unsupported statuses before calling the service", async () => {
    const response = await POST(
      reviewRequest({
        status: "blocked",
      }),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("status");
    expect(updateWaveTask).not.toHaveBeenCalled();
  });

  it("rejects invalid outcome scores before calling the service", async () => {
    const response = await POST(
      reviewRequest({
        outcomeScore: 6,
      }),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("outcomeScore");
    expect(updateWaveTask).not.toHaveBeenCalled();
  });
});
