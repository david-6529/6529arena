import { beforeEach, describe, expect, it, vi } from "vitest";

const { search6529WavesByName, waveBrief } = vi.hoisted(() => ({
  search6529WavesByName: vi.fn(),
  waveBrief: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/6529/client", () => ({
  search6529WavesByName,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    waveBrief,
  },
}));

import { normalizeWaveSearchResult, searchWaves } from "@/lib/6529/wave-search";

beforeEach(() => {
  search6529WavesByName.mockReset();
  search6529WavesByName.mockResolvedValue([]);
  waveBrief.findMany.mockReset();
});

describe("normalizeWaveSearchResult", () => {
  it("normalizes common 6529 wave id and name shapes", () => {
    expect(
      normalizeWaveSearchResult(
        {
          wave_id: "wave-1",
          wave_name: "6529 Builders",
          overview: "Build coordination.",
        },
        {
          source: "history",
        },
      ),
    ).toEqual({
      id: "wave-1",
      name: "6529 Builders",
      description: "Build coordination.",
      source: "history",
    });
  });
});

describe("searchWaves", () => {
  it("finds waves from live 6529 name search", async () => {
    waveBrief.findMany.mockResolvedValue([]);
    search6529WavesByName.mockResolvedValue([
      {
        id: "wave-live",
        name: "6529 Builders",
        description_drop: {
          parts: [
            {
              content: "Build coordination.",
            },
          ],
        },
      },
    ]);

    await expect(searchWaves("builders")).resolves.toEqual([
      {
        id: "wave-live",
        name: "6529 Builders",
        description: "Build coordination.",
        source: "6529",
      },
    ]);
    expect(search6529WavesByName).toHaveBeenCalledWith("builders", { limit: 8 });
  });

  it("finds waves by saved summary wave metadata", async () => {
    waveBrief.findMany.mockResolvedValue([
      {
        waveId: "wave-1",
        title: "Older summary title",
        contextJson: {
          wave: {
            id: "wave-1",
            name: "Meme Grants",
            description: "Grant decisions and open reviews.",
          },
        },
        createdAt: new Date("2026-06-18T00:00:00.000Z"),
      },
    ]);

    await expect(searchWaves("meme")).resolves.toEqual([
      {
        id: "wave-1",
        name: "Meme Grants",
        description: "Grant decisions and open reviews.",
        source: "history",
      },
    ]);
  });

  it("falls back to the summary title when saved wave metadata has no name", async () => {
    waveBrief.findMany.mockResolvedValue([
      {
        waveId: "wave-2",
        title: "Token mechanics catch-up",
        contextJson: {
          wave: {
            id: "wave-2",
          },
        },
        createdAt: new Date("2026-06-18T00:00:00.000Z"),
      },
    ]);

    await expect(searchWaves("token")).resolves.toEqual([
      {
        id: "wave-2",
        name: "Token mechanics catch-up",
        description: null,
        source: "history",
      },
    ]);
  });

  it("does not match saved waves by wave ID alone", async () => {
    waveBrief.findMany.mockResolvedValue([
      {
        waveId: "wave-4",
        title: "Coordination summary",
        contextJson: null,
        createdAt: new Date("2026-06-18T00:00:00.000Z"),
      },
    ]);

    await expect(searchWaves("wave-4")).resolves.toEqual([]);
  });

  it("keeps saved history matches when live 6529 search fails", async () => {
    search6529WavesByName.mockRejectedValue(new Error("rate limited"));
    waveBrief.findMany.mockResolvedValue([
      {
        waveId: "wave-5",
        title: "Governance catch-up",
        contextJson: null,
        createdAt: new Date("2026-06-18T00:00:00.000Z"),
      },
    ]);

    await expect(searchWaves("governance")).resolves.toEqual([
      {
        id: "wave-5",
        name: "Governance catch-up",
        description: null,
        source: "history",
      },
    ]);
  });
});
