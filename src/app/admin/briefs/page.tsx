import { FileText } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { WaveBriefAdmin, type WaveBriefRow } from "@/components/admin/wave-brief-admin";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";
import { scoreWaveBriefQuality } from "@/lib/briefs/quality";
import { validateWaveBriefContentSources, validateWaveBriefSources } from "@/lib/briefs/source-validation";
import { listWaveBriefs } from "@/lib/data/wave-briefs";
import { listEventsForEntities } from "@/lib/observability/events";

export const dynamic = "force-dynamic";

export default async function AdminBriefsPage() {
  const briefs = await listWaveBriefs(50);
  const history = await listEventsForEntities({
    entityType: "wave_brief",
    entityIds: briefs.map((brief) => brief.id),
    limitPerEntity: 6,
  });
  const rows: WaveBriefRow[] = briefs.map((brief) => ({
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

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <FileText className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Operator
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Wave Summary Drafts</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            Generate SwarmOps summaries from wave context, review them, and post approved drafts back to 6529 only when the operator has authority for that wave.
            Each generated summary shows its own change history from the audit log and a final-content source gate before approval or posting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/operator" variant="secondary">Operator Console</ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <WaveBriefAdmin briefs={rows} />
    </PageFrame>
  );
}
