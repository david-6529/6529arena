import { describe, expect, it } from "vitest";
import { scoreClosedBattleEntries } from "@/lib/data/battle-actions";

describe("scoreClosedBattleEntries", () => {
  it("uses weighted votes as the dominant signal when closing a battle", () => {
    const result = scoreClosedBattleEntries(
      [
        { id: "entry-a", label: "A", autoScore: 0.3, costUsd: 0.01, latencyMs: 1_000 },
        { id: "entry-b", label: "B", autoScore: 1, costUsd: 0.5, latencyMs: 30_000 },
      ],
      [
        { selectedEntryId: "entry-a", selectedLabel: "A", weight: 1 },
        { selectedEntryId: "entry-a", selectedLabel: "A", weight: 1 },
        { selectedEntryId: "entry-b", selectedLabel: "B", weight: 1 },
      ],
    );

    expect(result.totalWeight).toBe(3);
    expect(result.winner?.entry.id).toBe("entry-a");
    expect(result.scored.find((item) => item.entry.id === "entry-a")).toMatchObject({
      votesFor: 2,
      humanScore: 2 / 3,
      finalScore: 0.624,
    });
    expect(result.scored.find((item) => item.entry.id === "entry-b")).toMatchObject({
      votesFor: 1,
      humanScore: 1 / 3,
      finalScore: 0.433,
    });
  });

  it("falls back to neutral human scores when no votes exist", () => {
    const result = scoreClosedBattleEntries(
      [
        { id: "entry-a", label: "A", autoScore: 0.8 },
        { id: "entry-b", label: "B", autoScore: 0.5 },
      ],
      [],
    );

    expect(result.totalWeight).toBe(0);
    expect(result.scored.map((item) => item.humanScore)).toEqual([0.5, 0.5]);
    expect(result.winner?.entry.id).toBe("entry-a");
  });
});
