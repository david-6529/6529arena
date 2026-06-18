import { describe, expect, it } from "vitest";
import { buildWaveBriefPrompts } from "@/lib/briefs/prompts";
import { renderWaveBrief, renderWaveBriefPost } from "@/lib/briefs/render";
import { parseWaveBrief } from "@/lib/briefs/schema";
import { validateWaveBriefSources } from "@/lib/briefs/source-validation";
import { extractWaveTasksFromBriefJson } from "@/lib/data/wave-tasks";
import type { WaveDrop } from "@/lib/6529/types";

describe("buildWaveBriefPrompts", () => {
  it("orders source drops and includes the operator brief contract", () => {
    const drops: WaveDrop[] = [
      { id: "drop-2", serial_no: 2, content: "Second", author: { handle: "bob" } },
      { id: "drop-1", serial_no: 1, content: "First", author: { handle: "alice" } },
    ];
    const prompts = buildWaveBriefPrompts({
      waveId: "wave-1",
      requestText: "Brief this wave.",
      drops,
    });

    expect(prompts.systemPrompt).toContain("Wave Chief Of Staff");
    expect(prompts.systemPrompt).toContain("Return strict JSON with this exact shape");
    expect(prompts.userPrompt.indexOf("drop_id=drop-1")).toBeLessThan(prompts.userPrompt.indexOf("drop_id=drop-2"));
    expect(prompts.userPrompt).toContain("Operator request: Brief this wave.");
  });
});

describe("parseWaveBrief", () => {
  it("extracts fenced JSON and applies defaults", () => {
    const brief = parseWaveBrief(`
      \`\`\`json
      {
        "title": "Builder grant brief",
        "executive_summary": "The wave is discussing a grant rubric.",
        "summary_bullets": ["Rubric needed"],
        "decisions_needed": [
          { "title": "Approve rubric", "why": "Needed before voting", "source_drop_ids": ["drop-1"] }
        ]
      }
      \`\`\`
    `);

    expect(brief.title).toBe("Builder grant brief");
    expect(brief.open_questions).toEqual([]);
    expect(brief.action_items).toEqual([]);
    expect(brief.risks).toEqual([]);
    expect(brief.confidence).toBe(0.5);
  });
});

describe("renderWaveBrief", () => {
  it("renders operator sections and citations", () => {
    const output = renderWaveBrief({
      title: "Daily wave brief",
      executive_summary: "The wave aligned on next steps.",
      summary_bullets: ["A brief was requested."],
      decisions_needed: [{ title: "Pick owners", why: "Tasks need accountability", source_drop_ids: ["drop-1"] }],
      open_questions: [{ question: "Who owns follow-up?", source_drop_ids: ["drop-2"] }],
      action_items: [{ task: "Draft a post", suggested_owner: "admin", source_drop_ids: ["drop-3"] }],
      risks: [{ risk: "Consensus is still weak", severity: "medium", source_drop_ids: ["drop-4"] }],
      suggested_post: "Here is the proposed next step.",
      citations: [{ drop_id: "drop-1", reason: "Decision source" }],
      confidence: 0.73,
    });

    expect(output).toContain("**Daily wave brief**");
    expect(output).toContain("**Decisions needed**");
    expect(output).toContain("Pick owners");
    expect(output).toContain("Owner: admin.");
    expect(output).toContain("[medium] Consensus is still weak");
    expect(output).toContain("Confidence: 73%");
  });
});

describe("renderWaveBriefPost", () => {
  it("wraps the approved brief for posting", () => {
    const output = renderWaveBriefPost({
      appUrl: "https://arena.example",
      briefId: "brief-1",
      content: "Approved content",
    });

    expect(output).toContain("Agent-assisted wave brief:");
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
    });
  });
});

describe("extractWaveTasksFromBriefJson", () => {
  it("turns brief action items into deduped suggested tasks", () => {
    const tasks = extractWaveTasksFromBriefJson({
      title: "Ops brief",
      executive_summary: "Operators need follow-up.",
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
});
