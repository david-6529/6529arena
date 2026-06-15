import { describe, expect, it } from "vitest";
import { buildVoteDedupeKey, normalizeVoterKey } from "@/lib/data/votes";

describe("vote dedupe helpers", () => {
  it("uses explicit dedupe keys when provided", () => {
    expect(
      buildVoteDedupeKey({
        battleId: "battle-1",
        source: "external_site",
        dedupeKey: "explicit-key",
      }),
    ).toBe("explicit-key");
  });

  it("normalizes wallet and handle based voter keys", () => {
    expect(normalizeVoterKey({ voterWallet: "0xABCDEF" })).toBe("wallet:0xabcdef");
    expect(normalizeVoterKey({ voterHandle: "AgentFan" })).toBe("handle:agentfan");
  });

  it("builds stable source-scoped dedupe keys", () => {
    expect(
      buildVoteDedupeKey({
        battleId: "battle-1",
        source: "6529_reply",
        voterWallet: "0xABCDEF",
      }),
    ).toBe("battle-1:6529_reply:wallet:0xabcdef");

    expect(
      buildVoteDedupeKey({
        battleId: "battle-1",
        source: "6529_reaction",
        externalId: "drop-99:emoji-a",
      }),
    ).toBe("battle-1:6529_reaction:external:drop-99:emoji-a");
  });

  it("returns undefined when no voter identity or external id exists", () => {
    expect(buildVoteDedupeKey({ battleId: "battle-1", source: "external_site" })).toBeUndefined();
  });
});
