import { z } from "zod";

const sourceDropIds = z.array(z.string().min(1)).default([]);
const evidenceCoverage = z
  .object({
    summary: z.string().default(""),
    limitations: z.array(z.string()).default([]),
  })
  .default({
    summary: "",
    limitations: [],
  });

export const waveBriefSchema = z.object({
  title: z.string().min(1),
  executive_summary: z.string().min(1),
  evidence_coverage: evidenceCoverage,
  summary_bullets: z.array(z.string()).default([]),
  changes_since_previous: z
    .array(
      z.object({
        change: z.string().min(1),
        source_drop_ids: sourceDropIds,
      }),
    )
    .default([]),
  decisions_needed: z
    .array(
      z.object({
        title: z.string().min(1),
        why: z.string().default(""),
        source_drop_ids: sourceDropIds,
      }),
    )
    .default([]),
  open_questions: z
    .array(
      z.object({
        question: z.string().min(1),
        source_drop_ids: sourceDropIds,
      }),
    )
    .default([]),
  action_items: z
    .array(
      z.object({
        task: z.string().min(1),
        suggested_owner: z.string().default(""),
        source_drop_ids: sourceDropIds,
      }),
    )
    .default([]),
  risks: z
    .array(
      z.object({
        risk: z.string().min(1),
        severity: z.enum(["low", "medium", "high"]).default("medium"),
        source_drop_ids: sourceDropIds,
      }),
    )
    .default([]),
  suggested_post: z.string().default(""),
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

export type WaveBriefPayload = z.infer<typeof waveBriefSchema>;

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

export function parseWaveBrief(text: string) {
  const json = JSON.parse(extractJsonObject(text));

  return waveBriefSchema.parse(json);
}
