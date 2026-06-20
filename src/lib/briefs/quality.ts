import { waveBriefSchema } from "@/lib/briefs/schema";
import { validateWaveBriefSources } from "@/lib/briefs/source-validation";

export type WaveBriefQuality = {
  score: number;
  label: "ready" | "review" | "weak";
  blockers: string[];
  strengths: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreWaveBriefQuality(briefJson: unknown, dropsJson: unknown): WaveBriefQuality {
  const parsed = waveBriefSchema.safeParse(briefJson);

  if (!parsed.success) {
    return {
      score: 0,
      label: "weak",
      blockers: ["Summary JSON does not match the expected shape."],
      strengths: [],
    };
  }

  const brief = parsed.data;
  const sourceCheck = validateWaveBriefSources(briefJson, dropsJson);
  const sectionBulletCount = brief.sections.reduce((count, section) => count + section.bullets.length, 0);
  const blockers: string[] = [];
  const strengths: string[] = [];
  let score = 100;

  if (sourceCheck.missingDropIds.length) {
    score -= 35;
    blockers.push(`${sourceCheck.missingDropIds.length} cited source drops are missing.`);
  } else if (sourceCheck.referencedDropIds.length) {
    strengths.push("All cited drops are in stored context.");
  }

  if (!sourceCheck.referencedDropIds.length) {
    score -= 20;
    blockers.push("No source drops are cited.");
  }

  if (!brief.decisions_needed.length && !brief.action_items.length && !brief.open_questions.length && !sectionBulletCount) {
    score -= 25;
    blockers.push("No useful wave-specific sections or follow-ups were extracted.");
  } else {
    strengths.push(sectionBulletCount ? "Contains wave-specific sections." : "Contains follow-up items.");
  }

  if (
    !brief.risks.length &&
    (brief.wave_type === "project_ops" || brief.wave_type === "engineering_release" || brief.wave_type === "governance_decision")
  ) {
    score -= 10;
    blockers.push("No risks or objections were listed.");
  }

  if (!brief.suggested_post.trim()) {
    score -= 10;
    blockers.push("No suggested post was supplied.");
  }

  if (brief.confidence < 0.5) {
    score -= 15;
    blockers.push("Model confidence is low.");
  } else if (brief.confidence >= 0.75) {
    strengths.push("Model confidence is high.");
  }

  const finalScore = clampScore(score);

  return {
    score: finalScore,
    label: finalScore >= 80 && blockers.length === 0 ? "ready" : finalScore >= 55 ? "review" : "weak",
    blockers,
    strengths,
  };
}
