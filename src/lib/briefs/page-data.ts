import type { WaveBriefRow } from "@/components/admin/wave-brief-admin";
import { getWaveBriefSourceSummaries } from "@/lib/briefs/context-sources";
import { scoreWaveBriefQuality } from "@/lib/briefs/quality";
import { validateWaveBriefContentSources, validateWaveBriefSources } from "@/lib/briefs/source-validation";
import { listWaveBriefs } from "@/lib/data/wave-briefs";
import { listEventsForEntities } from "@/lib/observability/events";

export function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export async function getWaveBriefRows(limit = 50): Promise<WaveBriefRow[]> {
  const briefs = await listWaveBriefs(limit);
  const history = await listEventsForEntities({
    entityType: "wave_brief",
    entityIds: briefs.map((brief) => brief.id),
    limitPerEntity: 6,
  });

  return briefs.map((brief) => ({
    id: brief.id,
    waveId: brief.waveId,
    triggerDropId: brief.triggerDropId,
    status: brief.status,
    title: brief.title,
    requestText: brief.requestText,
    content: brief.content,
    provider: brief.provider,
    modelName: brief.modelName,
    promptTokens: brief.promptTokens,
    completionTokens: brief.completionTokens,
    costUsd: brief.costUsd,
    latencyMs: brief.latencyMs,
    reviewerNotes: brief.reviewerNotes,
    humanScore: brief.humanScore,
    humanScoreNotes: brief.humanScoreNotes,
    reviewedBy: brief.reviewedBy,
    approvedAt: brief.approvedAt?.toISOString() ?? null,
    rejectedAt: brief.rejectedAt?.toISOString() ?? null,
    postDropId: brief.postDropId,
    postedAt: brief.postedAt?.toISOString() ?? null,
    createdAt: brief.createdAt.toISOString(),
    previousBrief: brief.previousBrief
      ? {
          id: brief.previousBrief.id,
          title: brief.previousBrief.title,
          status: brief.previousBrief.status,
          postDropId: brief.previousBrief.postDropId,
          createdAt: brief.previousBrief.createdAt.toISOString(),
        }
      : null,
    sourceWaves: getWaveBriefSourceSummaries(brief.contextJson),
    sourceCheck: validateWaveBriefSources(brief.briefJson, brief.dropsJson),
    contentSourceCheck: validateWaveBriefContentSources(brief.content, brief.dropsJson),
    quality: scoreWaveBriefQuality(brief.briefJson, brief.dropsJson),
    history: (history[brief.id] ?? []).map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      message: event.message,
      actor: event.actor,
      createdAt: event.createdAt.toISOString(),
    })),
  }));
}
