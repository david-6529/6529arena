import { describe, expect, it } from "vitest";
import { assignCostTiers, type LeaderboardRow } from "@/lib/data/queries";

type UntieredRow = Omit<LeaderboardRow, "rank" | "costTier">;

function row(name: string, category: string, effectiveCost: number, avgScore = 0.7): UntieredRow {
  return {
    id: name,
    slug: name,
    name,
    owner: "tester",
    category,
    provider: "openai",
    modelName: "model",
    battles: 3,
    wins: 1,
    winRate: 1 / 3,
    qualityScore: avgScore,
    avgScore,
    avgCost: effectiveCost,
    effectiveCost,
    costBasis: "observed",
    valueScore: Number((avgScore / effectiveCost).toFixed(2)),
    avgLatency: 1_000,
    sampleSize: 3,
    lastActive: "2026-06-15T00:00:00.000Z",
  };
}

describe("assignCostTiers", () => {
  it("assigns low, medium, and high tiers by relative cost inside each category", () => {
    const tiered = assignCostTiers([
      row("a-low-1", "A", 0.01),
      row("a-low-2", "A", 0.02),
      row("a-medium-1", "A", 0.05),
      row("a-medium-2", "A", 0.08),
      row("a-high-1", "A", 0.2),
      row("a-high-2", "A", 0.5),
      row("b-low", "B", 0.03),
      row("b-medium", "B", 0.09),
      row("b-high", "B", 0.3),
    ]);

    expect(tiered.filter((item) => item.category === "A" && item.costTier === "Low").map((item) => item.name)).toEqual([
      "a-low-1",
      "a-low-2",
    ]);
    expect(tiered.filter((item) => item.category === "A" && item.costTier === "Medium").map((item) => item.name)).toEqual([
      "a-medium-1",
      "a-medium-2",
    ]);
    expect(tiered.filter((item) => item.category === "A" && item.costTier === "High").map((item) => item.name)).toEqual([
      "a-high-1",
      "a-high-2",
    ]);
    expect(Object.fromEntries(tiered.filter((item) => item.category === "B").map((item) => [item.name, item.costTier]))).toEqual({
      "b-low": "Low",
      "b-medium": "Medium",
      "b-high": "High",
    });
  });

  it("sorts rows by category, tier, routing score, then value score", () => {
    const tiered = assignCostTiers([
      row("higher-routing", "A", 0.01, 0.8),
      row("lower-routing", "A", 0.02, 0.7),
      row("medium", "A", 0.2, 0.9),
      row("high", "A", 0.5, 0.6),
      row("b-row", "B", 0.01, 0.9),
    ]);

    expect(tiered.map((item) => item.name)).toEqual(["higher-routing", "lower-routing", "medium", "high", "b-row"]);
    expect(tiered.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});
