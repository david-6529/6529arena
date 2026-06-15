import type { WaveDrop } from "@/lib/6529/types";
import type { StructuredSummary } from "@/lib/agents/schema";

export function scoreStructuredSummary(summary: StructuredSummary, drops: WaveDrop[]) {
  const realDropIds = new Set(drops.map((drop) => drop.id));
  const citationCount = summary.citations.length;
  const validCitations = summary.citations.filter((citation) => realDropIds.has(citation.drop_id)).length;
  const citationScore = citationCount ? validCitations / citationCount : 0;
  const hasDecision = summary.recommended_decision.trim().length > 10 ? 1 : 0;
  const coverage =
    Math.min(summary.summary_bullets.length, 5) / 5 / 2 +
    Math.min(summary.key_points.length, 5) / 5 / 2;
  const riskScore = summary.risks.length ? 1 : 0.4;
  const conciseEnough =
    [...summary.summary_bullets, ...summary.key_points, ...summary.risks].join(" ").length < 2500
      ? 1
      : 0.6;

  return Number(
    (
      coverage * 0.3 +
      citationScore * 0.25 +
      hasDecision * 0.2 +
      riskScore * 0.1 +
      conciseEnough * 0.1 +
      summary.confidence * 0.05
    ).toFixed(3),
  );
}

export function calculateFinalScore(params: {
  autoScore?: number | null;
  votesFor: number;
  totalVotes: number;
  costUsd?: number | null;
  latencyMs?: number | null;
}) {
  const humanVoteScore = params.totalVotes ? params.votesFor / params.totalVotes : 0.5;
  const autoScore = params.autoScore ?? 0.5;
  const costEfficiencyScore = params.costUsd == null ? 0.7 : Math.max(0, 1 - params.costUsd / 0.5);
  const latencyScore = params.latencyMs == null ? 0.7 : Math.max(0, 1 - params.latencyMs / 30_000);

  return Number(
    (humanVoteScore * 0.7 + autoScore * 0.2 + costEfficiencyScore * 0.05 + latencyScore * 0.05).toFixed(3),
  );
}
