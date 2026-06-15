import { describe, expect, it } from "vitest";
import { calculateFinalScore, scoreStructuredSummary } from "@/lib/agents/scoreOutput";
import type { StructuredSummary } from "@/lib/agents/schema";
import type { WaveDrop } from "@/lib/6529/types";

const drops: WaveDrop[] = [
  { id: "drop-1", content: "First source" },
  { id: "drop-2", content: "Second source" },
];

describe("scoreStructuredSummary", () => {
  it("rewards coverage, valid citations, decision, risks, concision, and confidence", () => {
    const summary: StructuredSummary = {
      title: "Useful summary",
      summary_bullets: ["a", "b", "c", "d", "e"],
      key_points: ["f", "g", "h", "i", "j"],
      risks: ["Main risk"],
      recommended_decision: "Proceed with the narrower scoped test first.",
      citations: [
        { drop_id: "drop-1", reason: "Supports the main claim" },
        { drop_id: "drop-2", reason: "Supports the recommendation" },
      ],
      confidence: 1,
    };

    expect(scoreStructuredSummary(summary, drops)).toBe(1);
  });

  it("penalizes weak coverage, invented citations, missing decision, and missing risks", () => {
    const summary: StructuredSummary = {
      title: "Weak summary",
      summary_bullets: ["a"],
      key_points: [],
      risks: [],
      recommended_decision: "",
      citations: [{ drop_id: "invented-drop", reason: "Not real" }],
      confidence: 0.5,
    };

    expect(scoreStructuredSummary(summary, drops)).toBe(0.195);
  });
});

describe("calculateFinalScore", () => {
  it("weights human votes most heavily while preserving auto, cost, and latency signal", () => {
    expect(
      calculateFinalScore({
        autoScore: 0.8,
        votesFor: 7,
        totalVotes: 10,
        costUsd: 0.05,
        latencyMs: 3_000,
      }),
    ).toBe(0.74);
  });

  it("uses neutral defaults when there are no votes or run metrics", () => {
    expect(
      calculateFinalScore({
        votesFor: 0,
        totalVotes: 0,
      }),
    ).toBe(0.52);
  });
});
