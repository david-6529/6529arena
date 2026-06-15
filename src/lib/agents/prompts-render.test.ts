import { describe, expect, it } from "vitest";
import { buildAgentPrompts, type AgentConfig } from "@/lib/agents/prompts";
import { renderBattlePost, renderStructuredSummary } from "@/lib/agents/render";
import type { WaveDrop } from "@/lib/6529/types";

const agent: AgentConfig = {
  id: "agent-1",
  name: "Test Summarizer",
  slug: "test-summarizer",
  category: "Wave Summarization",
  provider: "openai",
  modelName: "gpt-4.1-mini",
  systemPrompt: "Summarize carefully.",
  maxCostUsd: 0.1,
};

describe("buildAgentPrompts", () => {
  it("orders drops by serial number and includes the strict JSON contract", () => {
    const drops: WaveDrop[] = [
      {
        id: "drop-2",
        serial_no: 2,
        content: "Second message",
        author: { handle: "bob" },
        created_at: Date.parse("2026-06-15T12:02:00.000Z"),
      },
      {
        id: "drop-1",
        serial_no: 1,
        content: "First message",
        author: { handle: "alice" },
        created_at: Date.parse("2026-06-15T12:01:00.000Z"),
      },
    ];

    const prompts = buildAgentPrompts(agent, {
      waveId: "wave-1",
      requestText: "Summarize this wave.",
      drops,
    });

    expect(prompts.systemPrompt).toContain("Return strict JSON with this exact shape");
    expect(prompts.systemPrompt).toContain("cite only provided drop IDs");
    expect(prompts.userPrompt.indexOf("drop_id=drop-1")).toBeLessThan(prompts.userPrompt.indexOf("drop_id=drop-2"));
    expect(prompts.userPrompt).toContain("author=alice");
    expect(prompts.userPrompt).toContain("User request: Summarize this wave.");
  });

  it("truncates oversized drop content before sending it to a model", () => {
    const prompts = buildAgentPrompts(agent, {
      waveId: "wave-1",
      requestText: "Summarize.",
      drops: [{ id: "large-drop", content: "x".repeat(3_000) }],
    });

    expect(prompts.userPrompt).toContain("[truncated for context budget]");
    expect(prompts.userPrompt).not.toContain("x".repeat(2_700));
  });
});

describe("renderStructuredSummary", () => {
  it("renders missing optional sections with explicit fallback copy", () => {
    const output = renderStructuredSummary({
      title: "Short recap",
      summary_bullets: [],
      key_points: [],
      risks: [],
      recommended_decision: "",
      citations: [],
      confidence: 0.42,
    });

    expect(output).toContain("**Short recap**");
    expect(output).toContain("- Not enough signal in the fetched drops.");
    expect(output).toContain("No decision recommendation supplied.");
    expect(output).toContain("- No citations supplied.");
    expect(output).toContain("Confidence: 42%");
  });
});

describe("renderBattlePost", () => {
  it("renders anonymized options and links to the battle page", () => {
    const output = renderBattlePost({
      battleUrl: "https://arena.example/battles/battle-1",
      optionA: "Summary A",
      optionB: "Summary B",
    });

    expect(output).toContain("**Option A**\nSummary A");
    expect(output).toContain("**Option B**\nSummary B");
    expect(output).toContain("Battle page: https://arena.example/battles/battle-1");
    expect(output).toContain("accuracy, completeness, clarity");
  });
});
