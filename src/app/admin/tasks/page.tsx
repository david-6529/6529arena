import { ListTodo } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { WaveTaskAdmin, type WaveTaskRow } from "@/components/admin/wave-task-admin";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";
import { listWaveTasks } from "@/lib/data/wave-tasks";
import { listEventsForEntities } from "@/lib/observability/events";

export const dynamic = "force-dynamic";

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export default async function AdminTasksPage() {
  const tasks = await listWaveTasks(100);
  const history = await listEventsForEntities({
    entityType: "wave_task",
    entityIds: tasks.map((task) => task.id),
    limitPerEntity: 6,
  });
  const rows: WaveTaskRow[] = tasks.map((task) => ({
    id: task.id,
    waveBriefId: task.waveBriefId,
    waveId: task.waveId,
    title: task.title,
    status: task.status,
    workflowLabel: task.workflowLabel,
    suggestedOwner: task.suggestedOwner,
    assignedTo: task.assignedTo,
    claimedBy: task.claimedBy,
    claimedAt: task.claimedAt?.toISOString() ?? null,
    lastSeenBriefId: task.lastSeenBriefId,
    lastSeenAt: task.lastSeenAt?.toISOString() ?? null,
    seenCount: task.seenCount,
    sourceDropIds: toStringArray(task.sourceDropIdsJson),
    reviewerNotes: task.reviewerNotes,
    reviewedBy: task.reviewedBy,
    outcomeDropId: task.outcomeDropId,
    outcomeUrl: task.outcomeUrl,
    outcomeSummary: task.outcomeSummary,
    outcomeRecordedAt: task.outcomeRecordedAt?.toISOString() ?? null,
    outcomeScore: task.outcomeScore,
    outcomeScoreNotes: task.outcomeScoreNotes,
    outcomeReviewedBy: task.outcomeReviewedBy,
    outcomeReviewedAt: task.outcomeReviewedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    history: (history[task.id] ?? []).map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      message: event.message,
      actor: event.actor,
      createdAt: event.createdAt.toISOString(),
    })),
    brief: task.brief
      ? {
          id: task.brief.id,
          title: task.brief.title,
          status: task.brief.status,
          postDropId: task.brief.postDropId,
          createdAt: task.brief.createdAt.toISOString(),
        }
      : null,
    comments: task.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      author: comment.author,
      createdAt: comment.createdAt.toISOString(),
    })),
  }));

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <ListTodo className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Operator
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Wave Tasks</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            Review action items from Wave Summary Drafts and move accepted work through the review queue.
            Each task shows comments, outcome scores, and its own change history from the audit log.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/operator/briefs" variant="secondary">Summaries</ButtonLink>
          <ButtonLink href="/operator" variant="secondary">Operator Console</ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <WaveTaskAdmin tasks={rows} />
    </PageFrame>
  );
}
