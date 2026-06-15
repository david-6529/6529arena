import { describe, expect, it } from "vitest";
import { parseStructuredSummary } from "@/lib/agents/schema";

describe("parseStructuredSummary", () => {
  it("extracts fenced JSON and applies schema defaults", () => {
    const summary = parseStructuredSummary(`
      Here is the result:

      \`\`\`json
      {
        "title": "Wave recap",
        "summary_bullets": ["One"],
        "citations": [{ "drop_id": "drop-1", "reason": "Source" }]
      }
      \`\`\`
    `);

    expect(summary).toEqual({
      title: "Wave recap",
      summary_bullets: ["One"],
      key_points: [],
      risks: [],
      recommended_decision: "",
      citations: [{ drop_id: "drop-1", reason: "Source" }],
      confidence: 0.5,
    });
  });

  it("rejects invalid confidence and missing titles", () => {
    expect(() =>
      parseStructuredSummary(JSON.stringify({ title: "", confidence: 1.2 })),
    ).toThrow();
  });
});
