import { describe, expect, it } from "vitest";
import { getWaveBriefSourceSummaries } from "@/lib/briefs/context-sources";

describe("getWaveBriefSourceSummaries", () => {
  it("normalizes source rollups from wave bundle context", () => {
    expect(
      getWaveBriefSourceSummaries({
        context: {
          sources: [
            {
              waveId: "wave-parent",
              name: "Follow The Repo",
              label: "Primary wave",
              primary: true,
              dropCount: 2,
              searchedMessages: 8,
            },
            {
              waveId: "wave-firehose",
              name: "PR Firehose",
              label: "Raw PR feed",
              primary: false,
              dropCount: 12,
              searchedMessages: 40,
            },
          ],
        },
      }),
    ).toEqual([
      {
        waveId: "wave-parent",
        name: "Follow The Repo",
        label: "Primary wave",
        primary: true,
        dropCount: 2,
        searchedMessages: 8,
      },
      {
        waveId: "wave-firehose",
        name: "PR Firehose",
        label: "Raw PR feed",
        primary: false,
        dropCount: 12,
        searchedMessages: 40,
      },
    ]);
  });

  it("falls back to the primary wave for older summaries without source rollups", () => {
    expect(
      getWaveBriefSourceSummaries({
        wave: {
          id: "wave-1",
          name: "Meme Grants",
        },
      }),
    ).toEqual([
      {
        waveId: "wave-1",
        name: "Meme Grants",
        label: "Primary wave",
        primary: true,
        dropCount: null,
        searchedMessages: null,
      },
    ]);
  });
});
