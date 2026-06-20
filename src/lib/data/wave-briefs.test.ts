import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWaveBriefDraft,
  getWaveBriefCostStats,
  getWaveBriefReviewStats,
  postWaveBriefTo6529,
  previewWaveBriefPost,
  reviewWaveBrief,
} from "@/lib/data/wave-briefs";
import { postDrop } from "@/lib/6529/client";
import { fetchWaveContext } from "@/lib/6529/wave-context";
import { runWaveBrief } from "@/lib/briefs/runBrief";
import { createSuggestedTasksForBrief } from "@/lib/data/wave-tasks";
import { cacheWaveDrops } from "@/lib/data/wave-drops";
import { getPrisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

vi.mock("@/lib/6529/wave-context", () => ({
  fetchWaveContext: vi.fn(),
}));

vi.mock("@/lib/6529/client", () => ({
  postDrop: vi.fn(),
}));

vi.mock("@/lib/briefs/runBrief", () => ({
  runWaveBrief: vi.fn(),
}));

vi.mock("@/lib/data/wave-tasks", () => ({
  createSuggestedTasksForBrief: vi.fn(),
}));

vi.mock("@/lib/data/wave-drops", () => ({
  cacheWaveDrops: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
  prisma: undefined,
}));

vi.mock("@/lib/observability/events", () => ({
  logEvent: vi.fn(),
}));

const waveBrief = {
  count: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};

const db = {
  waveBrief,
};

const baseBrief = {
  id: "brief-1",
  waveId: "wave-1",
  status: "draft",
  title: "Original title",
  content: "Original content",
  reviewerNotes: null,
  reviewedBy: null,
  humanScore: null,
  humanScoreNotes: null,
  approvedAt: null,
  rejectedAt: null,
};

beforeEach(() => {
  vi.mocked(getPrisma).mockReturnValue(db as never);
  vi.mocked(fetchWaveContext).mockReset();
  vi.mocked(postDrop).mockReset();
  vi.mocked(runWaveBrief).mockReset();
  vi.mocked(createSuggestedTasksForBrief).mockReset();
  vi.mocked(cacheWaveDrops).mockReset();
  vi.mocked(logEvent).mockReset();
  waveBrief.count.mockReset();
  waveBrief.aggregate.mockReset();
  waveBrief.create.mockReset();
  waveBrief.findFirst.mockReset();
  waveBrief.findUnique.mockReset();
  waveBrief.update.mockReset();
  waveBrief.updateMany.mockReset();
  waveBrief.create.mockImplementation(({ data }) => ({
    ...baseBrief,
    ...data,
    id: "brief-new",
    createdAt: new Date("2026-06-18T01:00:00.000Z"),
  }));
  waveBrief.update.mockImplementation(({ data }) => ({
    ...baseBrief,
    ...data,
    id: baseBrief.id,
    waveId: baseBrief.waveId,
    status: data.status ?? baseBrief.status,
  }));
  waveBrief.updateMany.mockResolvedValue({ count: 1 });
  vi.mocked(cacheWaveDrops).mockResolvedValue({
    attemptedCount: 1,
    cachedCount: 1,
    createdCount: 1,
  });
});

describe("getWaveBriefReviewStats", () => {
  it("rolls up summary review scoring for reviewed summaries", async () => {
    waveBrief.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    waveBrief.aggregate.mockResolvedValue({
      _avg: {
        humanScore: 4.25,
      },
    });

    const stats = await getWaveBriefReviewStats();

    expect(stats).toEqual({
      totalCount: 8,
      reviewedCount: 5,
      scoredCount: 4,
      unscoredReviewedCount: 1,
      postedCount: 2,
      averageHumanScore: 4.25,
    });
    expect(waveBrief.count).toHaveBeenNthCalledWith(1);
    expect(waveBrief.count).toHaveBeenNthCalledWith(2, {
      where: {
        status: {
          in: ["approved", "posted", "rejected"],
        },
      },
    });
    expect(waveBrief.count).toHaveBeenNthCalledWith(3, {
      where: {
        status: {
          in: ["approved", "posted", "rejected"],
        },
        humanScore: {
          not: null,
        },
      },
    });
    expect(waveBrief.count).toHaveBeenNthCalledWith(4, {
      where: {
        status: "posted",
      },
    });
    expect(waveBrief.aggregate).toHaveBeenCalledWith({
      where: {
        status: {
          in: ["approved", "posted", "rejected"],
        },
        humanScore: {
          not: null,
        },
      },
      _avg: {
        humanScore: true,
      },
    });
  });
});

describe("getWaveBriefCostStats", () => {
  it("rolls up summary model cost and latency", async () => {
    waveBrief.count.mockResolvedValue(3);
    waveBrief.aggregate.mockResolvedValue({
      _sum: {
        costUsd: 0.145,
        promptTokens: 12_300,
        completionTokens: 2_700,
      },
      _avg: {
        costUsd: 0.0483333333,
        latencyMs: 1_450,
      },
      _max: {
        costUsd: 0.08,
      },
    });

    const stats = await getWaveBriefCostStats();

    expect(stats).toEqual({
      costedCount: 3,
      totalCostUsd: 0.145,
      averageCostUsd: 0.0483333333,
      maxCostUsd: 0.08,
      averageLatencyMs: 1_450,
      totalPromptTokens: 12_300,
      totalCompletionTokens: 2_700,
    });
    expect(waveBrief.count).toHaveBeenCalledWith({
      where: {
        costUsd: {
          not: null,
        },
      },
    });
    expect(waveBrief.aggregate).toHaveBeenCalledWith({
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
    });
  });
});

describe("postWaveBriefTo6529", () => {
  it("posts approved summaries and stores the returned 6529 drop id", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "approved",
      waveId: "wave-1",
      triggerDropId: "trigger-drop",
      postDropId: null,
      content: "Approved summary content.",
    });
    waveBrief.update.mockImplementation(({ data }) => ({
      ...baseBrief,
      ...data,
      id: "brief-1",
      waveId: "wave-1",
    }));
    vi.mocked(postDrop).mockResolvedValue({ id: "posted-drop-1" } as never);

    const brief = await postWaveBriefTo6529({
      briefId: "brief-1",
      appUrl: "https://arena.example",
    });

    expect(postDrop).toHaveBeenCalledWith(
      "wave-1",
      expect.stringContaining("Approved summary content."),
      { replyToDropId: "trigger-drop" },
    );
    expect(waveBrief.updateMany).toHaveBeenCalledWith({
      where: {
        id: "brief-1",
        status: "approved",
        postDropId: null,
      },
      data: {
        status: "posting",
      },
    });
    expect(waveBrief.update).toHaveBeenCalledWith({
      where: { id: "brief-1" },
      data: expect.objectContaining({
        status: "posted",
        postDropId: "posted-drop-1",
        postedAt: expect.any(Date),
      }),
    });
    expect(brief.postDropId).toBe("posted-drop-1");
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.posted_to_6529",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          postDropId: "posted-drop-1",
        }),
      }),
    );
  });

  it("logs failed 6529 post attempts without marking summaries as posted", async () => {
    const upstreamError = Object.assign(new Error("6529 API request failed: 503 Service Unavailable"), {
      status: 503,
    });
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "approved",
      waveId: "wave-1",
      triggerDropId: null,
      postDropId: null,
      content: "Approved summary content.",
    });
    vi.mocked(postDrop).mockRejectedValue(upstreamError);

    await expect(
      postWaveBriefTo6529({
        briefId: "brief-1",
        appUrl: "https://arena.example",
      }),
    ).rejects.toThrow("6529 API request failed");

    expect(waveBrief.update).not.toHaveBeenCalled();
    expect(waveBrief.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: "brief-1",
        status: "posting",
        postDropId: null,
      },
      data: {
        status: "approved",
      },
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.post_failed",
        severity: "error",
        entityType: "wave_brief",
        entityId: "brief-1",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          status: 503,
          error: "6529 API request failed: 503 Service Unavailable",
        }),
      }),
    );
  });

  it("blocks posting when final content cites drops outside the stored wave context", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "approved",
      waveId: "wave-1",
      triggerDropId: null,
      postDropId: null,
      content: "**Decisions needed**\n- Pick an owner. Sources: drop-1, missing-drop",
      dropsJson: {
        drops: [{ id: "drop-1" }],
      },
    });

    await expect(
      postWaveBriefTo6529({
        briefId: "brief-1",
        appUrl: "https://arena.example",
      }),
    ).rejects.toMatchObject({
      message: "Cannot post check-in because 1 cited source drop is missing from the stored wave context.",
      status: 422,
    });

    expect(postDrop).not.toHaveBeenCalled();
    expect(waveBrief.update).not.toHaveBeenCalled();
    expect(waveBrief.updateMany).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.post_blocked",
        severity: "warn",
        entityType: "wave_brief",
        entityId: "brief-1",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          missingDropIds: ["missing-drop"],
        }),
      }),
    );
  });

  it("rejects 6529 post responses without a drop id", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "approved",
      waveId: "wave-1",
      triggerDropId: null,
      postDropId: null,
      content: "Approved summary content.",
    });
    vi.mocked(postDrop).mockResolvedValue({ ok: true } as never);

    await expect(
      postWaveBriefTo6529({
        briefId: "brief-1",
        appUrl: "https://arena.example",
      }),
    ).rejects.toMatchObject({
      message: "6529 post response did not include a drop id.",
      status: 502,
    });

    expect(waveBrief.update).not.toHaveBeenCalled();
    expect(waveBrief.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: "brief-1",
        status: "posting",
        postDropId: null,
      },
      data: {
        status: "approved",
      },
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.post_failed",
        metadata: expect.objectContaining({
          status: 502,
          error: "6529 post response did not include a drop id.",
        }),
      }),
    );
  });

  it("rejects duplicate post attempts while a check-in is already posting", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "posting",
      waveId: "wave-1",
      postDropId: null,
      content: "Approved summary content.",
    });

    await expect(
      postWaveBriefTo6529({
        briefId: "brief-1",
        appUrl: "https://arena.example",
      }),
    ).rejects.toMatchObject({
      message: "A 6529 post is already in progress for this check-in.",
      status: 409,
    });

    expect(postDrop).not.toHaveBeenCalled();
    expect(waveBrief.updateMany).not.toHaveBeenCalled();
    expect(waveBrief.update).not.toHaveBeenCalled();
  });

  it("rejects duplicate post attempts when the posting claim is already held", async () => {
    waveBrief.findUnique
      .mockResolvedValueOnce({
        ...baseBrief,
        status: "approved",
        waveId: "wave-1",
        postDropId: null,
        content: "Approved summary content.",
      })
      .mockResolvedValueOnce({
        ...baseBrief,
        status: "posting",
        waveId: "wave-1",
        postDropId: null,
        content: "Approved summary content.",
      });
    waveBrief.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      postWaveBriefTo6529({
        briefId: "brief-1",
        appUrl: "https://arena.example",
      }),
    ).rejects.toMatchObject({
      message: "A 6529 post is already in progress for this check-in.",
      status: 409,
    });

    expect(postDrop).not.toHaveBeenCalled();
    expect(waveBrief.update).not.toHaveBeenCalled();
  });

  it("reuses a posted summary if the posting claim lost to a completed post", async () => {
    waveBrief.findUnique
      .mockResolvedValueOnce({
        ...baseBrief,
        status: "approved",
        waveId: "wave-1",
        postDropId: null,
        content: "Approved summary content.",
      })
      .mockResolvedValueOnce({
        ...baseBrief,
        status: "posted",
        waveId: "wave-1",
        postDropId: "posted-drop-1",
        content: "Approved summary content.",
      });
    waveBrief.updateMany.mockResolvedValueOnce({ count: 0 });

    const brief = await postWaveBriefTo6529({
      briefId: "brief-1",
      appUrl: "https://arena.example",
    });

    expect(brief.postDropId).toBe("posted-drop-1");
    expect(postDrop).not.toHaveBeenCalled();
    expect(waveBrief.update).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.post_idempotent_reuse",
        metadata: {
          postDropId: "posted-drop-1",
        },
      }),
    );
  });
});

describe("previewWaveBriefPost", () => {
  it("returns source-gate metadata for the saved summary content", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "approved",
      waveId: "wave-1",
      postDropId: null,
      content: "**Decisions needed**\n- Pick an owner. Sources: drop-1, missing-drop",
      dropsJson: {
        drops: [{ id: "drop-1" }],
      },
    });

    const preview = await previewWaveBriefPost({
      briefId: "brief-1",
      appUrl: "https://arena.example",
    });

    expect(preview.content).toContain("Agent-assisted wave check-in:");
    expect(preview.sourceCheck.missingDropIds).toEqual(["missing-drop"]);
    expect(preview.sourceCheck.missingReferences).toEqual([
      expect.objectContaining({
        dropId: "missing-drop",
        section: "Decisions needed",
      }),
    ]);
  });
});

describe("createWaveBriefDraft", () => {
  it("links a new summary to the latest reviewed summary for the same wave", async () => {
    const previousBrief = {
      id: "brief-old",
      title: "Previous summary",
      content: "Previous approved content",
      status: "approved",
      postDropId: "drop-old",
      createdAt: new Date("2026-06-18T00:00:00.000Z"),
    };
    waveBrief.findFirst.mockResolvedValue(previousBrief);
    vi.mocked(fetchWaveContext).mockResolvedValue({
      wave: { id: "wave-1" },
      relatedWaves: [
        {
          waveId: "wave-firehose",
          label: "Raw PR feed",
          name: "PR Firehose",
          dropCount: 1,
        },
      ],
      context: { maxMessages: 500 },
      drops: [
        {
          id: "drop-1",
          serial_no: 1,
          content: "New update",
          source_wave_id: "wave-firehose",
          source_wave_name: "PR Firehose",
          source_wave_role: "Raw PR feed",
        },
      ],
    } as never);
    vi.mocked(runWaveBrief).mockResolvedValue({
      provider: "openai",
      modelName: "gpt-4.1-mini",
      rawOutput: "{}",
      structured: {
        title: "New summary",
        wave_type: "project_ops",
        wave_type_label: "Project ops",
        executive_summary: "New update happened.",
        evidence_coverage: {
          summary: "Fetched one related wave drop.",
          limitations: [],
        },
        sections: [
          {
            title: "Current state",
            bullets: [{ text: "New update happened.", source_drop_ids: ["drop-1"] }],
          },
        ],
        summary_bullets: ["New update"],
        changes_since_previous: [{ change: "The plan changed.", source_drop_ids: ["drop-1"] }],
        decisions_needed: [],
        open_questions: [],
        action_items: [],
        risks: [],
        suggested_post: "",
        citations: [],
        confidence: 0.8,
      },
      renderedOutput: "Rendered summary",
      latencyMs: 123,
    });
    vi.mocked(createSuggestedTasksForBrief).mockResolvedValue({ createdCount: 0, rementionedCount: 1, skippedCount: 0 });

    await createWaveBriefDraft({
      waveId: "wave-1",
      requestText: "Create a summary.",
      relatedWaves: [{ waveId: "wave-firehose", label: "Raw PR feed" }],
    });

    expect(fetchWaveContext).toHaveBeenCalledWith({
      waveId: "wave-1",
      contextFrom: undefined,
      contextTo: undefined,
      maxMessages: undefined,
      includeAllHistory: undefined,
      relatedWaves: [{ waveId: "wave-firehose", label: "Raw PR feed" }],
    });
    expect(waveBrief.findFirst).toHaveBeenCalledWith({
      where: {
        waveId: "wave-1",
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
    expect(runWaveBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        previousSummary: previousBrief,
      }),
    );
    expect(cacheWaveDrops).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "drop-1",
        source_wave_id: "wave-firehose",
      }),
    ]);
    expect(waveBrief.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousBriefId: "brief-old",
        title: "New summary",
        content: "Rendered summary",
        contextJson: expect.objectContaining({
          relatedWaves: [
            expect.objectContaining({
              waveId: "wave-firehose",
              label: "Raw PR feed",
            }),
          ],
        }),
      }),
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.created",
        actor: "operator",
        metadata: expect.objectContaining({
          previousBriefId: "brief-old",
          relatedWaveCount: 1,
          cachedDropCount: 1,
          newCachedDropCount: 1,
          suggestedTaskCount: 0,
          rementionedSuggestedTaskCount: 1,
          skippedSuggestedTaskCount: 0,
        }),
      }),
    );
  });

  it("logs rejected summary generations before a draft is created", async () => {
    const rejection = Object.assign(new Error("OPENAI_API_KEY is required to generate openai wave check-ins."), {
      status: 422,
    });
    waveBrief.findFirst.mockResolvedValue(null);
    vi.mocked(fetchWaveContext).mockResolvedValue({
      wave: { id: "wave-1" },
      context: { maxMessages: 500 },
      drops: [{ id: "drop-1", serial_no: 1, content: "New update" }],
    } as never);
    vi.mocked(runWaveBrief).mockRejectedValue(rejection);

    await expect(
      createWaveBriefDraft({
        waveId: "wave-1",
        requestText: "Create a summary.",
        provider: "openai",
        modelName: "gpt-4.1-mini",
      }),
    ).rejects.toThrow("OPENAI_API_KEY is required");

    expect(waveBrief.create).not.toHaveBeenCalled();
    expect(createSuggestedTasksForBrief).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.generation_rejected",
        severity: "warn",
        entityType: "wave",
        entityId: "wave-1",
        actor: "operator",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          requestedProvider: "openai",
          requestedModel: "gpt-4.1-mini",
          status: 422,
          error: "OPENAI_API_KEY is required to generate openai wave check-ins.",
        }),
      }),
    );
  });
});

describe("reviewWaveBrief", () => {
  it("stores a human quality score during approval", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      dropsJson: {
        drops: [{ id: "drop-1" }],
      },
    });

    await reviewWaveBrief({
      briefId: "brief-1",
      action: "approve",
      title: "Edited title",
      content: "**Decisions needed**\n- Edited content. Sources: drop-1",
      reviewerNotes: "Ready after edits.",
      humanScore: 4,
      humanScoreNotes: "Useful, but needed one source cleanup.",
      reviewedBy: "alice",
    });

    expect(waveBrief.update).toHaveBeenCalledWith({
      where: { id: "brief-1" },
      data: expect.objectContaining({
        status: "approved",
        title: "Edited title",
        content: "**Decisions needed**\n- Edited content. Sources: drop-1",
        reviewerNotes: "Ready after edits.",
        humanScore: 4,
        humanScoreNotes: "Useful, but needed one source cleanup.",
        reviewedBy: "alice",
      }),
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.approve",
        metadata: expect.objectContaining({
          humanScore: 4,
        }),
      }),
    );
  });

  it("blocks approval when final summary content cites drops outside stored context", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      dropsJson: {
        drops: [{ id: "drop-1" }],
      },
    });

    await expect(
      reviewWaveBrief({
        briefId: "brief-1",
        action: "approve",
        content: "**Decisions needed**\n- Pick an owner. Sources: drop-1, missing-drop",
        humanScore: 4,
        reviewedBy: "alice",
      }),
    ).rejects.toMatchObject({
      message: "Cannot mark check-in checked because 1 cited source drop is missing from the stored wave context.",
      status: 422,
    });

    expect(waveBrief.update).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.approve_blocked",
        severity: "warn",
        entityType: "wave_brief",
        entityId: "brief-1",
        actor: "alice",
        metadata: expect.objectContaining({
          waveId: "wave-1",
          missingDropIds: ["missing-drop"],
        }),
      }),
    );
  });

  it("allows saving draft content while missing source references are being fixed", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      dropsJson: {
        drops: [{ id: "drop-1" }],
      },
    });

    await reviewWaveBrief({
      briefId: "brief-1",
      action: "update",
      content: "**Decisions needed**\n- Pick an owner. Sources: drop-1, missing-drop",
      reviewedBy: "alice",
    });

    expect(waveBrief.update).toHaveBeenCalledWith({
      where: { id: "brief-1" },
      data: expect.objectContaining({
        content: "**Decisions needed**\n- Pick an owner. Sources: drop-1, missing-drop",
      }),
    });
  });

  it("clears a human quality score when null is submitted", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      humanScore: 5,
      humanScoreNotes: "Great.",
    });

    await reviewWaveBrief({
      briefId: "brief-1",
      action: "update",
      humanScore: null,
      humanScoreNotes: null,
    });

    expect(waveBrief.update).toHaveBeenCalledWith({
      where: { id: "brief-1" },
      data: expect.objectContaining({
        humanScore: null,
        humanScoreNotes: null,
      }),
    });
  });

  it("clears reviewer notes when null is submitted", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      reviewerNotes: "Remove this note.",
    });

    await reviewWaveBrief({
      briefId: "brief-1",
      action: "update",
      reviewerNotes: null,
    });

    expect(waveBrief.update).toHaveBeenCalledWith({
      where: { id: "brief-1" },
      data: expect.objectContaining({
        reviewerNotes: null,
      }),
    });
  });

  it("clears approvedAt when an approved summary is rejected", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "approved",
      approvedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await reviewWaveBrief({
      briefId: "brief-1",
      action: "reject",
    });

    expect(waveBrief.update).toHaveBeenCalledWith({
      where: { id: "brief-1" },
      data: expect.objectContaining({
        status: "rejected",
        approvedAt: null,
        rejectedAt: expect.any(Date),
      }),
    });
  });

  it("moves an approved summary back to draft when saved title or content changes", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "approved",
      title: "Approved title",
      content: "Approved content",
      approvedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    waveBrief.update.mockImplementationOnce(({ data }) => ({
      ...baseBrief,
      ...data,
      status: data.status ?? "approved",
    }));

    await reviewWaveBrief({
      briefId: "brief-1",
      action: "update",
      title: "Approved title",
      content: "Edited approved content",
      reviewerNotes: "Needs another approval after edit.",
      reviewedBy: "alice",
    });

    expect(waveBrief.update).toHaveBeenCalledWith({
      where: { id: "brief-1" },
      data: expect.objectContaining({
        status: "draft",
        approvedAt: null,
        rejectedAt: null,
        title: "Approved title",
        content: "Edited approved content",
        reviewerNotes: "Needs another approval after edit.",
      }),
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.update",
        metadata: expect.objectContaining({
          previousStatus: "approved",
          status: "draft",
          approvalInvalidated: true,
        }),
      }),
    );
  });

  it("keeps approval when an approved summary metadata-only update is saved", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "approved",
      title: "Approved title",
      content: "Approved content",
      approvedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    waveBrief.update.mockImplementationOnce(({ data }) => ({
      ...baseBrief,
      ...data,
      status: data.status ?? "approved",
    }));

    await reviewWaveBrief({
      briefId: "brief-1",
      action: "update",
      reviewerNotes: "Metadata update only.",
      humanScore: 5,
      reviewedBy: "alice",
    });

    const updateData = waveBrief.update.mock.calls[0]?.[0].data;

    expect(updateData).toEqual(
      expect.objectContaining({
        title: "Approved title",
        content: "Approved content",
        reviewerNotes: "Metadata update only.",
        humanScore: 5,
      }),
    );
    expect(updateData).not.toHaveProperty("status");
    expect(updateData).not.toHaveProperty("approvedAt");
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "wave_brief.update",
        metadata: expect.objectContaining({
          previousStatus: "approved",
          status: "approved",
          approvalInvalidated: false,
        }),
      }),
    );
  });

  it("rejects title and content edits after a summary has been posted", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "posted",
      title: "Posted title",
      content: "Posted content",
      postDropId: "drop-123",
    });

    await expect(
      reviewWaveBrief({
        briefId: "brief-1",
        action: "update",
        title: "Changed title",
        content: "Posted content",
      }),
    ).rejects.toMatchObject({
      message: "Posted check-ins cannot change title or content. Create a new check-in for public revisions.",
      status: 409,
    });

    expect(waveBrief.update).not.toHaveBeenCalled();
  });

  it("rejects approval after a summary has been rejected", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "rejected",
      rejectedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    await expect(
      reviewWaveBrief({
        briefId: "brief-1",
        action: "approve",
      }),
    ).rejects.toMatchObject({
      message: "Discarded check-ins cannot be checked or discarded again. Create a new check-in for revisions.",
      status: 409,
    });

    expect(waveBrief.update).not.toHaveBeenCalled();
  });

  it("rejects title and content edits after a summary has been rejected", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "rejected",
      title: "Rejected title",
      content: "Rejected content",
      rejectedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    await expect(
      reviewWaveBrief({
        briefId: "brief-1",
        action: "update",
        title: "Changed title",
        content: "Rejected content",
      }),
    ).rejects.toMatchObject({
      message: "Discarded check-ins cannot change title or content. Create a new check-in for revisions.",
      status: 409,
    });

    expect(waveBrief.update).not.toHaveBeenCalled();
  });

  it("rejects approval or rejection while a summary is posting", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "posting",
      title: "Posting title",
      content: "Posting content",
    });

    await expect(
      reviewWaveBrief({
        briefId: "brief-1",
        action: "reject",
      }),
    ).rejects.toMatchObject({
      message: "Posting check-ins cannot be checked or discarded while the 6529 post is in progress.",
      status: 409,
    });

    expect(waveBrief.update).not.toHaveBeenCalled();
  });

  it("rejects title and content edits while a summary is posting", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "posting",
      title: "Posting title",
      content: "Posting content",
    });

    await expect(
      reviewWaveBrief({
        briefId: "brief-1",
        action: "update",
        title: "Changed title",
        content: "Posting content",
      }),
    ).rejects.toMatchObject({
      message: "Posting check-ins cannot change title or content while the 6529 post is in progress.",
      status: 409,
    });

    expect(waveBrief.update).not.toHaveBeenCalled();
  });

  it("allows posting summary review metadata updates when content is unchanged", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "posting",
      title: "Posting title",
      content: "Posting content",
    });

    await reviewWaveBrief({
      briefId: "brief-1",
      action: "update",
      title: "Posting title",
      content: "Posting content",
      reviewerNotes: "Post is in flight.",
      humanScore: 5,
    });

    expect(waveBrief.update).toHaveBeenCalledWith({
      where: { id: "brief-1" },
      data: expect.objectContaining({
        title: "Posting title",
        content: "Posting content",
        reviewerNotes: "Post is in flight.",
        humanScore: 5,
      }),
    });
  });

  it("allows rejected summary review metadata updates when content is unchanged", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "rejected",
      title: "Rejected title",
      content: "Rejected content",
      rejectedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    await reviewWaveBrief({
      briefId: "brief-1",
      action: "update",
      title: "Rejected title",
      content: "Rejected content",
      reviewerNotes: "Rejected because sources were weak.",
      humanScore: 2,
      humanScoreNotes: "Not useful enough to share.",
    });

    expect(waveBrief.update).toHaveBeenCalledWith({
      where: { id: "brief-1" },
      data: expect.objectContaining({
        title: "Rejected title",
        content: "Rejected content",
        reviewerNotes: "Rejected because sources were weak.",
        humanScore: 2,
        humanScoreNotes: "Not useful enough to share.",
      }),
    });
  });

  it("allows posted summary review metadata updates when public content is unchanged", async () => {
    waveBrief.findUnique.mockResolvedValue({
      ...baseBrief,
      status: "posted",
      title: "Posted title",
      content: "Posted content",
      postDropId: "drop-123",
    });

    await reviewWaveBrief({
      briefId: "brief-1",
      action: "update",
      title: "Posted title",
      content: "Posted content",
      reviewerNotes: "Post-review note.",
      humanScore: 5,
      humanScoreNotes: "Useful after posting.",
    });

    expect(waveBrief.update).toHaveBeenCalledWith({
      where: { id: "brief-1" },
      data: expect.objectContaining({
        title: "Posted title",
        content: "Posted content",
        reviewerNotes: "Post-review note.",
        humanScore: 5,
        humanScoreNotes: "Useful after posting.",
      }),
    });
  });
});
