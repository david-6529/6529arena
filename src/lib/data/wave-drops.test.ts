import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheWaveDrops } from "@/lib/data/wave-drops";

const mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    cachedWaveDrop: {
      createMany: mocks.createMany,
      updateMany: mocks.updateMany,
    },
  },
}));

beforeEach(() => {
  mocks.createMany.mockReset();
  mocks.updateMany.mockReset();
  mocks.createMany.mockResolvedValue({ count: 1 });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("cacheWaveDrops", () => {
  it("stores fetched 6529 drops with wave and author query fields", async () => {
    const result = await cacheWaveDrops([
      {
        id: "drop-1",
        serial_no: 7,
        created_at: Date.parse("2026-06-18T10:00:00.000Z"),
        updated_at: Date.parse("2026-06-18T10:05:00.000Z"),
        title: "Release note",
        content: "  The deploy bus shipped.  ",
        drop_type: "CHAT",
        author: {
          handle: "punk6529",
          display: "6529",
          primary_wallet: "0xabc",
        },
        source_wave_id: "wave-1",
        source_wave_name: "Follow The Repo",
        source_wave_role: "Primary wave",
        raw: {
          id: "drop-1",
        },
      },
      {
        id: "drop-1",
        source_wave_id: "wave-1",
        content: "duplicate",
      },
    ]);

    expect(result).toEqual({
      attemptedCount: 2,
      cachedCount: 1,
      createdCount: 1,
    });
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          dropId: "drop-1",
          waveId: "wave-1",
          waveName: "Follow The Repo",
          sourceRole: "Primary wave",
          serialNo: 7,
          authorHandle: "punk6529",
          authorWallet: "0xabc",
          title: "Release note",
          content: "The deploy bus shipped.",
          dropType: "CHAT",
          rawJson: {
            id: "drop-1",
          },
        }),
      ],
      skipDuplicates: true,
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        dropId: {
          in: ["drop-1"],
        },
      },
      data: {
        fetchedAt: expect.any(Date),
      },
    });
  });

  it("skips drops without a source wave id", async () => {
    const result = await cacheWaveDrops([
      {
        id: "drop-1",
        content: "No source metadata.",
      },
    ]);

    expect(result).toEqual({
      attemptedCount: 1,
      cachedCount: 0,
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
