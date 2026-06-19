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
    expect(prompts.userPrompt).toContain("Evidence coverage metadata:");
    expect(prompts.userPrompt).toContain("PR Firehose (firehose-wave) role=Raw PR feed: 1 drops");
    expect(prompts.userPrompt).toContain("source_wave=PR Firehose");
    expect(prompts.userPrompt).toContain("source_wave_id=firehose-wave");
  });

  it("includes all-history coverage metadata and cap warnings", () => {
    const prompts = buildWaveBriefPrompts({
      waveId: "parent-wave",
      requestText: "Summarize the PR pipeline.",
      context: {
        mode: "all",
        includeAllHistory: true,
        maxMessages: 20000,
        maxMessagesPerWave: 5000,
        searchedMessages: 1695,
        hitCap: false,
        explicitWindow: false,
        from: null,
        to: null,
        sources: [
          {
            waveId: "firehose-wave",
            name: "PR Firehose",
            label: "Raw PR feed",
            primary: false,
            availableDropCount: 1637,
            dropCount: 1637,
            hitCap: false,
            oldestDropAt: "2026-06-10T12:56:04.965Z",
            newestDropAt: "2026-06-19T04:55:41.986Z",
            searchedMessages: 1637,
          },
        ],
      },
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

    expect(prompts.systemPrompt).toContain("evidence_coverage");
    expect(prompts.systemPrompt).toContain("raw bot feeds, bot digests, and human coordination chats");
    expect(prompts.userPrompt).toContain("coverage_mode=all include_all_history=true");
    expect(prompts.userPrompt).toContain("PR Firehose (firehose-wave) role=Raw PR feed");
    expect(prompts.userPrompt).toContain("fetched=1637 available=1637");
  });

  it("keeps the newest drops when the prompt context budget overflows", () => {
    const drops = Array.from({ length: 90 }, (_, index) => {
      const serial = index + 1;

      return {
        id: `drop-${serial}`,
        serial_no: serial,
        created_at: Date.parse("2026-06-18T00:00:00.000Z") + serial,
        content: `Message ${serial} ${"x".repeat(2_400)}`,
      };
    });
    const prompts = buildWaveBriefPrompts({
      waveId: "long-wave",
      requestText: "Summarize everything.",
      drops,
    });

    expect(prompts.userPrompt).toContain("Prompt context includes the newest");
    expect(prompts.userPrompt).toContain("drop_id=drop-90");
    expect(prompts.userPrompt).not.toContain("drop_id=drop-1 serial=1");
  });
});
