import { describe, expect, it } from "vitest";
import { getMockWaveDrops } from "@/lib/6529/mock";
import { dropCreatedAtMs, normalizeWaveDrop, normalizeWaveDropsResponse } from "@/lib/6529/normalize";

describe("normalizeWaveDrop", () => {
  it("normalizes ids, author aliases, timestamps, and direct content", () => {
    const drop = normalizeWaveDrop({
      dropId: "drop-123",
      serialNo: "42",
      created_at: 1_718_000_000,
      updatedAt: "2026-06-15T12:00:00.000Z",
      text: "Hello wave",
      creator: {
        username: "6529er",
        avatar_url: "https://example.com/pfp.png",
        wallet_address: "0xabc",
      },
      reaction_counts: [{ type: "like", count: 2 }],
    });

    expect(drop).toMatchObject({
      id: "drop-123",
      serial_no: 42,
      created_at: 1_718_000_000_000,
      updated_at: Date.parse("2026-06-15T12:00:00.000Z"),
      content: "Hello wave",
      author: {
        handle: "6529er",
        pfp: "https://example.com/pfp.png",
        primary_wallet: "0xabc",
      },
      reactions: [{ type: "like", count: 2 }],
    });
  });

  it("builds content from parts when direct content is absent", () => {
    const drop = normalizeWaveDrop({
      id: "parts-drop",
      parts: [
        { part_id: "1", body: "First part" },
        { part_id: "2", text: "Second part" },
      ],
    });

    expect(drop.content).toBe("First part\n\nSecond part");
    expect(drop.parts).toEqual([
      { id: "1", content: "First part" },
      { id: "2", content: "Second part" },
    ]);
  });
});

describe("mock 6529 fixtures", () => {
  it("provide normalized drops for offline workflow tests", () => {
    const response = getMockWaveDrops("mock-wave-test");

    expect(response.wave).toMatchObject({ id: "mock-wave-test" });
    expect(response.drops.length).toBeGreaterThanOrEqual(5);
    expect(response.drops[0]).toMatchObject({
      id: "mock-drop-001",
      author: { handle: "0xCuttlefish" },
    });
    expect(response.drops.every((drop) => drop.content)).toBe(true);
  });
});

describe("normalizeWaveDropsResponse", () => {
  it("normalizes nested drop arrays and root drops", () => {
    const response = normalizeWaveDropsResponse({
      data: {
        wave: { id: "wave-1" },
        drops: [
          {
            id: "drop-1",
            createdAt: "2026-06-15T12:30:00.000Z",
            markdown: "Nested content",
            author: { handle: "alice" },
          },
        ],
        root_drop: {
          id: "root",
          content: "Root content",
        },
      },
    });

    expect(response.wave).toEqual({ id: "wave-1" });
    expect(response.drops).toHaveLength(1);
    expect(response.drops[0]).toMatchObject({
      id: "drop-1",
      content: "Nested content",
      author: { handle: "alice" },
    });
    expect(dropCreatedAtMs(response.drops[0])).toBe(Date.parse("2026-06-15T12:30:00.000Z"));
    expect(response.root_drop).toMatchObject({
      id: "root",
      content: "Root content",
    });
  });
});
