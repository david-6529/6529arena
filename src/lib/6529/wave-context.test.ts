import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWaveDrops } from "@/lib/6529/client";
import { fetchWaveContext, previewWaveContext } from "@/lib/6529/wave-context";

vi.mock("@/lib/6529/client", () => ({
  getWaveDrops: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-18T12:00:00.000Z"));
  vi.mocked(getWaveDrops).mockReset();
  vi.mocked(getWaveDrops).mockImplementation(async (waveId: string, params?: { serialNoLimit?: number }) => {
    const wave = {
      id: waveId,
      name: waveId === "wave-main" ? "Follow The Repo" : "PR Firehose",
    };

    if (params?.serialNoLimit) {
      return {
        wave,
        drops: [],
      };
    }

    return {
      wave,
      drops:
        waveId === "wave-main"
          ? [
              {
                id: "main-drop-1",
                serial_no: 10,
                created_at: Date.parse("2026-06-18T10:00:00.000Z"),
                content: "Parent navigation update.",
              },
            ]
          : [
              {
                id: "firehose-drop-1",
                serial_no: 11,
                created_at: Date.parse("2026-06-18T11:00:00.000Z"),
                content: "Raw PR card.",
              },
            ],
    };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchWaveContext", () => {
  it("collects a parent wave plus related waves and tags each drop with its source", async () => {
    const context = await fetchWaveContext({
      waveId: "wave-main",
      relatedWaves: [
        {
          waveId: "https://6529.io/waves/wave-firehose",
          label: "Raw PR feed",
        },
      ],
      maxMessages: 10,
    });

    expect(getWaveDrops).toHaveBeenCalledWith("wave-main", expect.objectContaining({ limit: 5 }));
    expect(getWaveDrops).toHaveBeenCalledWith("wave-firehose", expect.objectContaining({ limit: 5 }));
    expect(context.wave).toEqual({ id: "wave-main", name: "Follow The Repo" });
    expect(context.relatedWaves).toEqual([
      expect.objectContaining({
        waveId: "wave-firehose",
        label: "Raw PR feed",
        name: "PR Firehose",
        dropCount: 1,
      }),
    ]);
    expect(context.drops).toEqual([
      expect.objectContaining({
        id: "main-drop-1",
        source_wave_id: "wave-main",
        source_wave_name: "Follow The Repo",
        source_wave_role: "Primary wave",
      }),
      expect.objectContaining({
        id: "firehose-drop-1",
        source_wave_id: "wave-firehose",
        source_wave_name: "PR Firehose",
        source_wave_role: "Raw PR feed",
      }),
    ]);
    expect(context.context.sources).toEqual([
      expect.objectContaining({
        waveId: "wave-main",
        primary: true,
        dropCount: 1,
      }),
      expect.objectContaining({
        waveId: "wave-firehose",
        primary: false,
        label: "Raw PR feed",
        dropCount: 1,
      }),
    ]);
  });
});

describe("previewWaveContext", () => {
  it("shows source wave metadata in preview samples", async () => {
    const preview = await previewWaveContext({
      waveId: "wave-main",
      relatedWaves: [{ waveId: "wave-firehose", label: "Raw PR feed" }],
      maxMessages: 10,
    });

    expect(preview.sampleDrops.at(-1)).toEqual(
      expect.objectContaining({
        id: "firehose-drop-1",
        sourceWaveId: "wave-firehose",
        sourceWaveName: "PR Firehose",
        sourceWaveRole: "Raw PR feed",
      }),
    );
  });
});
