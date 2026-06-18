import { ListTodo } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { WaveTaskAdmin, type WaveTaskRow } from "@/components/admin/wave-task-admin";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";
import { listWaveTasks } from "@/lib/data/wave-tasks";

export const dynamic = "force-dynamic";

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export default async function AdminTasksPage() {
  const tasks = await listWaveTasks(100);
  const rows: WaveTaskRow[] = tasks.map((task) => ({
    id: task.id,
    waveBriefId: task.waveBriefId,
    waveId: task.waveId,
    title: task.title,
    status: task.status,
    suggestedOwner: task.suggestedOwner,
    sourceDropIds: toStringArray(task.sourceDropIdsJson),
    reviewerNotes: task.reviewerNotes,
    reviewedBy: task.reviewedBy,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    brief: task.brief
      ? {
          id: task.brief.id,
          title: task.brief.title,
          status: task.brief.status,
          postDropId: task.brief.postDropId,
          createdAt: task.brief.createdAt.toISOString(),
        }
      : null,
  }));

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <ListTodo className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Admin
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Wave Tasks</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            Review agent-suggested action items from Wave Brief Drafts and move accepted work through the operator queue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/briefs" variant="secondary">Briefs</ButtonLink>
          <ButtonLink href="/admin" variant="secondary">Run Battle</ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <WaveTaskAdmin tasks={rows} />
    </PageFrame>
  );
}
