import { describe, expect, it } from "vitest";
import { hasUnsavedPostContentChanges, isWaveBriefApprovalBlocked, isWaveBriefContentLocked } from "@/lib/briefs/draft-state";
import { buildWaveBriefPrompts } from "@/lib/briefs/prompts";
import { scoreWaveBriefQuality } from "@/lib/briefs/quality";
import { renderWaveBrief, renderWaveBriefPost } from "@/lib/briefs/render";
import { parseWaveBrief } from "@/lib/briefs/schema";
import { validateWaveBriefContentSources, validateWaveBriefSources } from "@/lib/briefs/source-validation";
import { extractWaveTasksFromBriefJson, getWaveTaskDedupeKey, normalizeWaveTaskOutcome } from "@/lib/data/wave-tasks";
import type { WaveDrop } from "@/lib/6529/types";

describe("hasUnsavedPostContentChanges", () => {
  it("tracks title and content changes that would make a post preview stale", () => {
    expect(
      hasUnsavedPostContentChanges({
        savedTitle: "Saved",
        savedContent: "Saved content",
        draftTitle: "Saved",
        draftContent: "Saved content",
      }),
    ).toBe(false);
    expect(
      hasUnsavedPostContentChanges({
        savedTitle: "Saved",
        savedContent: "Saved content",
        draftTitle: "Edited",
        draftContent: "Saved content",
      }),
    ).toBe(true);
    expect(
      hasUnsavedPostContentChanges({
        savedTitle: "Saved",
        savedContent: "Saved content",
        draftTitle: "Saved",
        draftContent: "Edited content",
      }),
    ).toBe(true);
  });
});

describe("isWaveBriefApprovalBlocked", () => {
  it("blocks approval when content is locked, source-blocked, or unsaved content would make the saved source gate stale", () => {
    expect(
      isWaveBriefApprovalBlocked({
        status: "draft",
        finalMissingSourceCount: 0,
        hasUnsavedContentChanges: false,
      }),
    ).toBe(false);
    expect(
      isWaveBriefApprovalBlocked({
        status: "posted",
        finalMissingSourceCount: 0,
        hasUnsavedContentChanges: false,
      }),
    ).toBe(true);
    expect(
      isWaveBriefApprovalBlocked({
        status: "rejected",
        finalMissingSourceCount: 0,
        hasUnsavedContentChanges: false,
      }),
    ).toBe(true);
    expect(
      isWaveBriefApprovalBlocked({
        status: "posting",
        finalMissingSourceCount: 0,
        hasUnsavedContentChanges: false,
      }),
    ).toBe(true);
    expect(
      isWaveBriefApprovalBlocked({
        status: "draft",
        finalMissingSourceCount: 1,
        hasUnsavedContentChanges: false,
      }),
    ).toBe(true);
    expect(
      isWaveBriefApprovalBlocked({
        status: "draft",
        finalMissingSourceCount: 0,
        hasUnsavedContentChanges: true,
      }),
    ).toBe(true);
  });
});

describe("isWaveBriefContentLocked", () => {
  it("locks posted, rejected, and in-flight posting check-in content", () => {
    expect(isWaveBriefContentLocked("draft")).toBe(false);
    expect(isWaveBriefContentLocked("approved")).toBe(false);
    expect(isWaveBriefContentLocked("posted")).toBe(true);
    expect(isWaveBriefContentLocked("rejected")).toBe(true);
    expect(isWaveBriefContentLocked("posting")).toBe(true);
  });
});

describe("buildWaveBriefPrompts", () => {
  it("orders source drops and includes the wave check-in contract", () => {
    const drops: WaveDrop[] = [
      { id: "drop-2", serial_no: 2, content: "Second", author: { handle: "bob" } },
      { id: "drop-1", serial_no: 1, content: "First", author: { handle: "alice" } },
    ];
    const prompts = buildWaveBriefPrompts({
      waveId: "wave-1",
      requestText: "Summarize this wave.",
      drops,
    });

    expect(prompts.systemPrompt).toContain("source-grounded 6529 wave check-in assistant");
    expect(prompts.systemPrompt).toContain("Return strict JSON with this exact shape");
    expect(prompts.userPrompt.indexOf("drop_id=drop-1")).toBeLessThan(prompts.userPrompt.indexOf("drop_id=drop-2"));
    expect(prompts.userPrompt).toContain("Check-in request: Summarize this wave.");
  });

  it("includes previous checked check-in context when available", () => {
    const prompts = buildWaveBriefPrompts({
      waveId: "wave-1",
      requestText: "Summarize this wave.",
      drops: [{ id: "drop-1", serial_no: 1, content: "New decision", author: { handle: "alice" } }],
      previousSummary: {
        id: "brief-old",
        title: "Yesterday check-in",
        content: "The previous check-in said the grant rubric was still open.",
        status: "approved",
        createdAt: new Date("2026-06-18T00:00:00.000Z"),
        postDropId: "drop-old",
      },
    });

    expect(prompts.systemPrompt).toContain("changes_since_previous");
    expect(prompts.userPrompt).toContain("previous_checkin_id=brief-old");
    expect(prompts.userPrompt).toContain("Yesterday check-in");
    expect(prompts.userPrompt).toContain("fill changes_since_previous with material changes");
  });
});

describe("parseWaveBrief", () => {
  it("extracts fenced JSON and applies defaults", () => {
    const brief = parseWaveBrief(`
      \`\`\`json
      {
        "title": "Builder grant summary",
        "executive_summary": "The wave is discussing a grant rubric.",
        "summary_bullets": ["Rubric needed"],
        "changes_since_previous": [
          { "change": "Rubric owner changed", "source_drop_ids": ["drop-1"] }
        ],
        "decisions_needed": [
          { "title": "Approve rubric", "why": "Needed before voting", "source_drop_ids": ["drop-1"] }
        ]
      }
      \`\`\`
    `);

    expect(brief.title).toBe("Builder grant summary");
    expect(brief.changes_since_previous).toEqual([
      { change: "Rubric owner changed", source_drop_ids: ["drop-1"] },
    ]);
    expect(brief.open_questions).toEqual([]);
    expect(brief.action_items).toEqual([]);
    expect(brief.risks).toEqual([]);
    expect(brief.evidence_coverage).toEqual({ summary: "", limitations: [] });
    expect(brief.wave_type).toBe("community_chat");
    expect(brief.sections).toEqual([]);
    expect(brief.confidence).toBe(0.5);
  });
});

describe("renderWaveBrief", () => {
  it("renders summary sections and citations", () => {
    const output = renderWaveBrief({
      title: "Daily wave summary",
      wave_type: "engineering_release",
      wave_type_label: "Engineering release",
      executive_summary: "The wave aligned on next steps.",
      evidence_coverage: {
        summary: "Fetched recent wave context.",
        limitations: ["Older drops were not requested."],
      },
      sections: [
        {
          title: "Release state",
          bullets: [{ text: "Deploy lane is clear.", source_drop_ids: ["drop-6"] }],
        },
      ],
      summary_bullets: ["A summary was requested."],
      changes_since_previous: [{ change: "The owner changed.", source_drop_ids: ["drop-5"] }],
      decisions_needed: [{ title: "Pick owners", why: "Tasks need accountability", source_drop_ids: ["drop-1"] }],
      open_questions: [{ question: "Who owns follow-up?", source_drop_ids: ["drop-2"] }],
      action_items: [{ task: "Draft a post", suggested_owner: "admin", source_drop_ids: ["drop-3"] }],
      risks: [{ risk: "Consensus is still weak", severity: "medium", source_drop_ids: ["drop-4"] }],
      suggested_post: "Here is the proposed next step.",
      citations: [{ drop_id: "drop-1", reason: "Decision source" }],
      confidence: 0.73,
    });

    expect(output).toContain("**Daily wave summary**");
    expect(output).toContain("**Wave type**");
    expect(output).toContain("Engineering release");
    expect(output).toContain("**Release state**");
    expect(output).toContain("Deploy lane is clear. Sources: drop-6");
    expect(output).toContain("**Evidence**");
    expect(output).toContain("Fetched recent wave context.");
    expect(output).toContain("**Changed since last check-in**");
    expect(output).toContain("The owner changed. Sources: drop-5");
    expect(output).toContain("**Follow-ups**");
    expect(output).toContain("Pick owners");
    expect(output).toContain("Owner: admin.");
    expect(output).toContain("[medium] Consensus is still weak");
    expect(output).toContain("Confidence: 73%");
  });
});

describe("renderWaveBriefPost", () => {
  it("wraps the checked check-in for posting", () => {
    const output = renderWaveBriefPost({
      appUrl: "https://arena.example",
      briefId: "brief-1",
      content: "Approved content",
    });

    expect(output).toContain("Agent-assisted wave check-in:");
    expect(output).toContain("Approved content");
    expect(output).not.toContain("/admin/briefs");
  });
});

describe("validateWaveBriefSources", () => {
  it("finds cited drop IDs missing from the stored context", () => {
    const result = validateWaveBriefSources(
      {
        decisions_needed: [{ source_drop_ids: ["drop-1", "missing-drop"] }],
        citations: [{ drop_id: "drop-2", reason: "Evidence" }],
      },
      {
        drops: [{ id: "drop-1" }, { id: "drop-2" }],
      },
    );

    expect(result).toEqual({
      totalDrops: 2,
      referencedDropIds: ["drop-1", "drop-2", "missing-drop"],
      missingDropIds: ["missing-drop"],
      references: [
        {
          dropId: "drop-1",
          path: "decisions_needed[0].source_drop_ids",
          section: "Decisions needed #1",
        },
        {
          dropId: "missing-drop",
          path: "decisions_needed[0].source_drop_ids",
          section: "Decisions needed #1",
        },
        {
          dropId: "drop-2",
          path: "citations[0].drop_id",
          section: "Citations #1",
        },
      ],
      missingReferences: [
        {
          dropId: "missing-drop",
          path: "decisions_needed[0].source_drop_ids",
          section: "Decisions needed #1",
        },
      ],
    });
  });

  it("finds missing drop IDs in final rendered summary content", () => {
    const result = validateWaveBriefContentSources(
      `**Decisions needed**
- Pick the owner. sources: drop-1, missing-drop

**Open questions**
- Who verifies this? Source: missing-single

**Action items**
- Collect context. Source drops: drop-2; missing-semi and missing-and

**Citations**
- drop-2: evidence
- missing-citation: not in context`,
      {
        drops: [{ id: "drop-1" }, { id: "drop-2" }],
      },
    );

    expect(result.missingDropIds).toEqual(["missing-and", "missing-citation", "missing-drop", "missing-semi", "missing-single"]);
    expect(result.missingReferences).toEqual([
      {
        dropId: "missing-drop",
        path: "content.line2.sources[1]",
        section: "Decisions needed",
      },
      {
        dropId: "missing-single",
        path: "content.line5.sources[0]",
        section: "Open questions",
      },
      {
        dropId: "missing-semi",
        path: "content.line8.sources[1]",
        section: "Action items",
      },
      {
        dropId: "missing-and",
        path: "content.line8.sources[2]",
        section: "Action items",
      },
      {
        dropId: "missing-citation",
        path: "content.citations.line12",
        section: "Citations",
      },
    ]);
  });
});

describe("scoreWaveBriefQuality", () => {
  it("marks a source-linked actionable summary as ready", () => {
    const quality = scoreWaveBriefQuality(
      {
        title: "Ops summary",
        executive_summary: "The wave has next steps.",
        decisions_needed: [{ title: "Pick owner", why: "Work needs an owner", source_drop_ids: ["drop-1"] }],
        action_items: [{ task: "Post update", suggested_owner: "admin", source_drop_ids: ["drop-2"] }],
        risks: [{ risk: "Timeline can slip", severity: "medium", source_drop_ids: ["drop-1"] }],
        suggested_post: "Here is the plan.",
        citations: [{ drop_id: "drop-1", reason: "Decision source" }],
        confidence: 0.82,
      },
      { drops: [{ id: "drop-1" }, { id: "drop-2" }] },
    );

    expect(quality.label).toBe("ready");
    expect(quality.score).toBe(100);
    expect(quality.blockers).toEqual([]);
  });

  it("penalizes missing sources and missing wave-specific content", () => {
    const quality = scoreWaveBriefQuality(
      {
        title: "Thin summary",
        executive_summary: "Not much happened.",
        citations: [{ drop_id: "missing-drop", reason: "Only source" }],
        confidence: 0.4,
      },
      { drops: [{ id: "drop-1" }] },
    );

    expect(quality.label).toBe("weak");
    expect(quality.blockers).toContain("1 cited source drops are missing.");
    expect(quality.blockers).toContain("No useful wave-specific sections or follow-ups were extracted.");
    expect(quality.blockers).toContain("Model confidence is low.");
  });

  it("marks malformed summary JSON as weak", () => {
    expect(scoreWaveBriefQuality({ title: "" }, { drops: [] })).toEqual({
      score: 0,
      label: "weak",
      blockers: ["Summary JSON does not match the expected shape."],
      strengths: [],
    });
  });
});

describe("extractWaveTasksFromBriefJson", () => {
  it("turns summary action items into deduped suggested tasks", () => {
    const tasks = extractWaveTasksFromBriefJson({
      title: "Ops summary",
      executive_summary: "The wave has follow-up.",
      action_items: [
        {
          task: "  Draft the next wave update   ",
          suggested_owner: "  alice  ",
          source_drop_ids: ["drop-1", "drop-1", "drop-2"],
        },
      ],
    });

    expect(tasks).toEqual([
      {
        title: "Draft the next wave update",
        suggestedOwner: "alice",
        sourceDropIds: ["drop-1", "drop-2"],
      },
    ]);
  });

  it("dedupes equivalent task titles inside one summary", () => {
    const tasks = extractWaveTasksFromBriefJson({
      title: "Ops summary",
      executive_summary: "The wave has follow-up.",
      action_items: [
        {
          task: "Draft the next wave update",
          suggested_owner: "alice",
          source_drop_ids: ["drop-1"],
        },
        {
          task: "draft   the NEXT wave update!",
          suggested_owner: "bob",
          source_drop_ids: ["drop-2"],
        },
      ],
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.suggestedOwner).toBe("alice");
  });
});

describe("getWaveTaskDedupeKey", () => {
  it("normalizes case, spacing, and punctuation", () => {
    expect(getWaveTaskDedupeKey(" Draft: the NEXT wave update! ")).toBe("draft the next wave update");
  });
});

describe("normalizeWaveTaskOutcome", () => {
  it("treats blank outcome evidence as empty", () => {
    expect(
      normalizeWaveTaskOutcome({
        outcomeDropId: "   ",
        outcomeUrl: "",
        outcomeSummary: "\n\t",
      }),
    ).toEqual({
      outcomeDropId: null,
      outcomeUrl: null,
      outcomeSummary: null,
      hasOutcome: false,
    });
  });

  it("trims and compacts real outcome evidence", () => {
    expect(
      normalizeWaveTaskOutcome({
        outcomeDropId: " drop-1 ",
        outcomeUrl: " https://example.com/outcome ",
        outcomeSummary: "  Posted   the final update. ",
      }),
    ).toEqual({
      outcomeDropId: "drop-1",
      outcomeUrl: "https://example.com/outcome",
      outcomeSummary: "Posted the final update.",
      hasOutcome: true,
    });
  });
});
