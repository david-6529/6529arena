import { describe, expect, it } from "vitest";
import { buildWaveBriefPrompts } from "@/lib/briefs/prompts";

describe("buildWaveBriefPrompts", () => {
  it("includes source wave roles when summarizing a wave bundle", () => {
    const prompts = buildWaveBriefPrompts({
      waveId: "parent-wave",
      requestText: "Summarize the PR pipeline.",
      drops: [
        {
          id: "drop-1",
          serial_no: 1,
          created_at: Date.parse("2026-06-18T10:00:00.000Z"),
          content: "Raw PR opened.",
          source_wave_id: "firehose-wave",
          source_wave_name: "PR Firehose",
          source_wave_role: "Raw PR feed",
        },
      ],
    });

    expect(prompts.userPrompt).toContain("Wave sources covered:");
    expect(prompts.userPrompt).toContain("PR Firehose (firehose-wave) role=Raw PR feed: 1 drops");
    expect(prompts.userPrompt).toContain("source_wave=PR Firehose");
    expect(prompts.userPrompt).toContain("source_wave_id=firehose-wave");
  });
});
