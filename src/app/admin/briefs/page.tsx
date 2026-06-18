import { FileText } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { WaveBriefAdmin, type WaveBriefRow } from "@/components/admin/wave-brief-admin";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";
import { listWaveBriefs } from "@/lib/data/wave-briefs";

export const dynamic = "force-dynamic";

export default async function AdminBriefsPage() {
  const briefs = await listWaveBriefs(50);
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
    reviewedBy: brief.reviewedBy,
    approvedAt: brief.approvedAt?.toISOString() ?? null,
    rejectedAt: brief.rejectedAt?.toISOString() ?? null,
    postDropId: brief.postDropId,
    postedAt: brief.postedAt?.toISOString() ?? null,
    createdAt: brief.createdAt.toISOString(),
  }));

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <FileText className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Admin
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Wave Brief Drafts</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            Generate operator-ready SwarmOps briefs from wave context, review them, and post approved drafts back to 6529.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin" variant="secondary">Run Battle</ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <WaveBriefAdmin briefs={rows} />
    </PageFrame>
  );
}
