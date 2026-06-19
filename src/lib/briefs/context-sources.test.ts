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
              availableDropCount: 8,
              dropCount: 2,
              hitCap: false,
              oldestDropAt: "2026-06-18T00:00:00.000Z",
              newestDropAt: "2026-06-18T01:00:00.000Z",
              searchedMessages: 8,
            },
            {
              waveId: "wave-firehose",
              name: "PR Firehose",
              label: "Raw PR feed",
              primary: false,
              availableDropCount: 40,
              dropCount: 12,
              hitCap: true,
              oldestDropAt: "2026-06-18T02:00:00.000Z",
              newestDropAt: "2026-06-18T03:00:00.000Z",
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
        availableDropCount: 8,
        dropCount: 2,
        hitCap: false,
        oldestDropAt: "2026-06-18T00:00:00.000Z",
        newestDropAt: "2026-06-18T01:00:00.000Z",
        searchedMessages: 8,
      },
      {
        waveId: "wave-firehose",
        name: "PR Firehose",
        label: "Raw PR feed",
        primary: false,
        availableDropCount: 40,
        dropCount: 12,
        hitCap: true,
        oldestDropAt: "2026-06-18T02:00:00.000Z",
        newestDropAt: "2026-06-18T03:00:00.000Z",
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
        availableDropCount: null,
        dropCount: null,
        hitCap: null,
        oldestDropAt: null,
        newestDropAt: null,
        searchedMessages: null,
      },
    ]);
  });
});
