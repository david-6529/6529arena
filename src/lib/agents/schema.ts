import { z } from "zod";

export const summarySchema = z.object({
  title: z.string().min(1),
  summary_bullets: z.array(z.string()).default([]),
  key_points: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  recommended_decision: z.string().default(""),
  citations: z
    .array(
      z.object({
        drop_id: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type StructuredSummary = z.infer<typeof summarySchema>;

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    return candidate;
  }

  return candidate.slice(first, last + 1);
}

export function parseStructuredSummary(text: string) {
  const json = JSON.parse(extractJsonObject(text));

  return summarySchema.parse(json);
}
