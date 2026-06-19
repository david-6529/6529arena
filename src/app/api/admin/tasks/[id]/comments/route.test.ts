import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createWaveTaskComment } from "@/lib/data/wave-tasks";

vi.mock("@/lib/data/wave-tasks", () => ({
  createWaveTaskComment: vi.fn(),
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

function commentRequest(body: unknown) {
  delete process.env.ADMIN_API_KEY;

  return new Request("https://arena.example/api/admin/tasks/task-1/comments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function params(id = "task-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/tasks/:id/comments", () => {
  it("creates a task comment", async () => {
    vi.mocked(createWaveTaskComment).mockResolvedValue({
      id: "comment-1",
      taskId: "task-1",
      body: "Followed up.",
      author: "ops",
      createdAt: new Date("2026-06-18T03:00:00.000Z"),
    } as never);

    const response = await POST(
      commentRequest({
        body: "Followed up.",
        author: "ops",
      }),
      params(),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      comment: {
        id: "comment-1",
        taskId: "task-1",
        body: "Followed up.",
        author: "ops",
      },
    });
    expect(createWaveTaskComment).toHaveBeenCalledWith({
      taskId: "task-1",
      body: "Followed up.",
      author: "ops",
    });
  });

  it("rejects empty comments before calling the service", async () => {
    const response = await POST(
      commentRequest({
        body: " ",
      }),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("body");
    expect(createWaveTaskComment).not.toHaveBeenCalled();
  });
});
