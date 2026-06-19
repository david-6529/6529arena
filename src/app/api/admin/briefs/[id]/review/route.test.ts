import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { reviewWaveBrief } from "@/lib/data/wave-briefs";

vi.mock("@/lib/data/wave-briefs", () => ({
  reviewWaveBrief: vi.fn(),
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

  return new Request("https://arena.example/api/admin/briefs/brief-1/review", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function params(id = "brief-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/briefs/:id/review", () => {
  it("passes human summary scores to the review service", async () => {
    vi.mocked(reviewWaveBrief).mockResolvedValue({
      id: "brief-1",
      humanScore: 5,
      humanScoreNotes: "Ready to share.",
    } as never);

    const response = await POST(
      reviewRequest({
        action: "approve",
        title: "Reviewed summary",
        content: "Approved content",
        reviewerNotes: null,
        humanScore: 5,
        humanScoreNotes: "Ready to share.",
        reviewedBy: "alice",
      }),
      params(),
    );

    await expect(response.json()).resolves.toEqual({
      brief: {
        id: "brief-1",
        humanScore: 5,
        humanScoreNotes: "Ready to share.",
      },
    });
    expect(reviewWaveBrief).toHaveBeenCalledWith({
      briefId: "brief-1",
      action: "approve",
      title: "Reviewed summary",
      content: "Approved content",
      reviewerNotes: null,
      humanScore: 5,
      humanScoreNotes: "Ready to share.",
      reviewedBy: "alice",
    });
  });

  it("rejects human scores outside the 1-5 range", async () => {
    const response = await POST(
      reviewRequest({
        action: "update",
        humanScore: 6,
      }),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("humanScore");
    expect(reviewWaveBrief).not.toHaveBeenCalled();
  });

  it("returns source-gate approval failures from the review service", async () => {
    vi.mocked(reviewWaveBrief).mockRejectedValue(
      Object.assign(new Error("Cannot mark check-in checked because 1 cited source drop is missing from the stored wave context."), {
        status: 422,
      }),
    );

    const response = await POST(
      reviewRequest({
        action: "approve",
        content: "**Decisions needed**\n- Pick an owner. Sources: missing-drop",
      }),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("Cannot mark check-in checked because 1 cited source drop is missing from the stored wave context.");
  });
});
