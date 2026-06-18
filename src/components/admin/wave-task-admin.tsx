"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, KeyRound, ListTodo, Play, Save, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";

export type WaveTaskRow = {
  id: string;
  waveBriefId: string | null;
  waveId: string;
  title: string;
  status: string;
  suggestedOwner: string | null;
  sourceDropIds: string[];
  reviewerNotes: string | null;
  reviewedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  brief: {
    id: string;
    title: string;
    status: string;
    postDropId: string | null;
    createdAt: string;
  } | null;
};

type ApiState = {
  loading?: string;
  error?: string;
  message?: string;
};

type TaskEdit = {
  title: string;
  status: string;
  suggestedOwner: string;
  reviewerNotes: string;
};

const statusOptions = ["suggested", "confirmed", "in_progress", "completed", "rejected"];

function defaultEdit(task: WaveTaskRow): TaskEdit {
  return {
    title: task.title,
    status: task.status,
    suggestedOwner: task.suggestedOwner ?? "",
    reviewerNotes: task.reviewerNotes ?? "",
  };
}

function statusClass(status: string) {
  if (status === "completed") {
    return "border-emerald-800 bg-emerald-950/40 text-emerald-200";
  }

  if (status === "confirmed" || status === "in_progress") {
    return "border-cyan-800 bg-cyan-950/40 text-cyan-200";
  }

  if (status === "rejected") {
    return "border-red-800 bg-red-950/40 text-red-200";
  }

  return "border-amber-800 bg-amber-950/40 text-amber-200";
}

function errorMessage(payload: { error?: string; errorId?: string }) {
  return payload.errorId ? `${payload.error ?? "Request failed."} (${payload.errorId})` : payload.error ?? "Request failed.";
}

export function WaveTaskAdmin({ tasks }: { tasks: WaveTaskRow[] }) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [state, setState] = useState<ApiState>({});
  const [edits, setEdits] = useState<Record<string, TaskEdit>>(() =>
    Object.fromEntries(tasks.map((task) => [task.id, defaultEdit(task)])),
  );

  const filteredTasks = useMemo(() => {
    if (statusFilter === "all") {
      return tasks;
    }

    if (statusFilter === "open") {
      return tasks.filter((task) => task.status !== "completed" && task.status !== "rejected");
    }

    return tasks.filter((task) => task.status === statusFilter);
  }, [statusFilter, tasks]);

  function headers() {
    return {
      "content-type": "application/json",
      ...(adminKey ? { "x-admin-api-key": adminKey } : {}),
    };
  }

  function updateEdit(taskId: string, patch: Partial<TaskEdit>) {
    setEdits((current) => ({
      ...current,
      [taskId]: {
        ...current[taskId],
        ...patch,
      },
    }));
  }

  async function saveTask(task: WaveTaskRow, status?: string) {
    const edit = edits[task.id] ?? defaultEdit(task);

    setState({ loading: task.id });

    try {
      const response = await fetch(`/api/admin/tasks/${task.id}/review`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          title: edit.title,
          status: status ?? edit.status,
          suggestedOwner: edit.suggestedOwner || undefined,
          reviewerNotes: edit.reviewerNotes || undefined,
          reviewedBy: reviewedBy || undefined,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(errorMessage(json));
      }

      setState({ message: `Updated task ${task.id.slice(0, 8)}.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Task update failed." });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr_0.8fr]">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-zinc-950 dark:text-zinc-50">
              <ListTodo className="h-4 w-4" aria-hidden="true" />
              Task Review Queue
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Confirm, assign, progress, or reject agent-suggested work before it becomes operational.
            </p>
          </div>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Status</span>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="open">Open</option>
              <option value="all">All</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 flex items-center gap-2">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Admin key
            </span>
            <Input
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Optional after admin login"
            />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 lg:col-span-3">
            <span className="mb-1 block">Reviewer</span>
            <Input value={reviewedBy} onChange={(event) => setReviewedBy(event.target.value)} placeholder="admin handle" />
          </label>
        </div>

        {state.error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {state.message}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4">
        {filteredTasks.map((task) => {
          const edit = edits[task.id] ?? defaultEdit(task);

          return (
            <article key={task.id} className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={statusClass(task.status)}>{task.status}</Badge>
                    <Badge>Wave {task.waveId}</Badge>
                    <Badge>{task.sourceDropIds.length} sources</Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Suggested {formatDate(task.createdAt)}
                    {task.completedAt ? ` · completed ${formatDate(task.completedAt)}` : ""}
                  </p>
                </div>
                {task.brief ? (
                  <div className="max-w-xl text-sm text-zinc-700 dark:text-zinc-300">
                    <p className="font-semibold text-zinc-950 dark:text-zinc-50">From brief</p>
                    <p>{task.brief.title}</p>
                    <p className="text-zinc-500 dark:text-zinc-500">
                      {task.brief.status}
                      {task.brief.postDropId ? ` · posted ${task.brief.postDropId}` : ""}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.4fr_0.4fr]">
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="mb-1 block">Task</span>
                  <Input value={edit.title} onChange={(event) => updateEdit(task.id, { title: event.target.value })} />
                </label>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="mb-1 block">Owner</span>
                  <Input
                    value={edit.suggestedOwner}
                    onChange={(event) => updateEdit(task.id, { suggestedOwner: event.target.value })}
                    placeholder="unassigned"
                  />
                </label>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="mb-1 block">Status</span>
                  <Select value={edit.status} onChange={(event) => updateEdit(task.id, { status: event.target.value })}>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 lg:col-span-3">
                  <span className="mb-1 block">Reviewer notes</span>
                  <Textarea
                    className="min-h-24"
                    value={edit.reviewerNotes}
                    onChange={(event) => updateEdit(task.id, { reviewerNotes: event.target.value })}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => saveTask(task)} disabled={state.loading !== undefined || !edit.title.trim()}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save
                </Button>
                <Button type="button" onClick={() => saveTask(task, "confirmed")} disabled={state.loading !== undefined || !edit.title.trim()}>
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  Confirm
                </Button>
                <Button type="button" variant="secondary" onClick={() => saveTask(task, "in_progress")} disabled={state.loading !== undefined || !edit.title.trim()}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Start
                </Button>
                <Button type="button" variant="secondary" onClick={() => saveTask(task, "completed")} disabled={state.loading !== undefined || !edit.title.trim()}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Complete
                </Button>
                <Button type="button" variant="danger" onClick={() => saveTask(task, "rejected")} disabled={state.loading !== undefined}>
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Reject
                </Button>
              </div>

              {task.sourceDropIds.length ? (
                <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  Source drops: {task.sourceDropIds.join(", ")}
                </p>
              ) : null}
            </article>
          );
        })}
        {!filteredTasks.length ? (
          <div className="rounded-md border border-zinc-200 bg-white px-5 py-8 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            No tasks match this filter.
          </div>
        ) : null}
      </section>
    </div>
  );
}
