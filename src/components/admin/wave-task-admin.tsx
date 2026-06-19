"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, KeyRound, ListTodo, MessageSquare, Play, Plus, Save, Star, XCircle } from "lucide-react";
import { EntityHistoryList, type EntityHistoryEventRow } from "@/components/admin/entity-history-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { waveTaskWorkflowTemplates } from "@/lib/workflows/task-workflows";

export type WaveTaskRow = {
  id: string;
  waveBriefId: string | null;
  waveId: string;
  title: string;
  status: string;
  workflowLabel: string | null;
  suggestedOwner: string | null;
  assignedTo: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  lastSeenBriefId: string | null;
  lastSeenAt: string | null;
  seenCount: number;
  sourceDropIds: string[];
  reviewerNotes: string | null;
  reviewedBy: string | null;
  outcomeDropId: string | null;
  outcomeUrl: string | null;
  outcomeSummary: string | null;
  outcomeRecordedAt: string | null;
  outcomeScore: number | null;
  outcomeScoreNotes: string | null;
  outcomeReviewedBy: string | null;
  outcomeReviewedAt: string | null;
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
  comments: Array<{
    id: string;
    body: string;
    author: string | null;
    createdAt: string;
  }>;
  history: EntityHistoryEventRow[];
};

type ApiState = {
  loading?: string;
  error?: string;
  message?: string;
};

type TaskEdit = {
  title: string;
  status: string;
  workflowLabel: string;
  suggestedOwner: string;
  assignedTo: string;
  claimedBy: string;
  reviewerNotes: string;
  outcomeDropId: string;
  outcomeUrl: string;
  outcomeSummary: string;
  outcomeScore: string;
  outcomeScoreNotes: string;
};

const statusOptions = ["suggested", "confirmed", "in_progress", "completed", "rejected"];
const workflowOptions = waveTaskWorkflowTemplates.map((template) => template.label);

function defaultEdit(task: WaveTaskRow): TaskEdit {
  return {
    title: task.title,
    status: task.status,
    workflowLabel: task.workflowLabel ?? "",
    suggestedOwner: task.suggestedOwner ?? "",
    assignedTo: task.assignedTo ?? "",
    claimedBy: task.claimedBy ?? "",
    reviewerNotes: task.reviewerNotes ?? "",
    outcomeDropId: task.outcomeDropId ?? "",
    outcomeUrl: task.outcomeUrl ?? "",
    outcomeSummary: task.outcomeSummary ?? "",
    outcomeScore: task.outcomeScore == null ? "" : String(task.outcomeScore),
    outcomeScoreNotes: task.outcomeScoreNotes ?? "",
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

function WorkflowOptions({ currentValue, emptyLabel }: { currentValue: string; emptyLabel: string }) {
  const hasCustomValue = currentValue && !workflowOptions.includes(currentValue);

  return (
    <>
      <option value="">{emptyLabel}</option>
      {workflowOptions.map((workflow) => (
        <option key={workflow} value={workflow}>
          {workflow}
        </option>
      ))}
      {hasCustomValue ? <option value={currentValue}>{currentValue}</option> : null}
    </>
  );
}

export function WaveTaskAdmin({ tasks }: { tasks: WaveTaskRow[] }) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [newWaveId, setNewWaveId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newWorkflowLabel, setNewWorkflowLabel] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [newSourceDropIds, setNewSourceDropIds] = useState("");
  const [newStatus, setNewStatus] = useState("confirmed");
  const [newNotes, setNewNotes] = useState("");
  const [state, setState] = useState<ApiState>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
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

  function updateCommentDraft(taskId: string, body: string) {
    setCommentDrafts((current) => ({
      ...current,
      [taskId]: body,
    }));
  }

  function parseSourceDropIds(value: string) {
    return [...new Set(value.split(/[\s,]+/).map((dropId) => dropId.trim()).filter(Boolean))];
  }

  async function createTask() {
    setState({ loading: "create" });

    try {
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          waveId: newWaveId,
          title: newTitle,
          status: newStatus,
          workflowLabel: newWorkflowLabel || undefined,
          suggestedOwner: newOwner || undefined,
          assignedTo: newAssignedTo || undefined,
          sourceDropIds: parseSourceDropIds(newSourceDropIds),
          reviewerNotes: newNotes || undefined,
          reviewedBy: reviewedBy || undefined,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(errorMessage(json));
      }

      setNewTitle("");
      setNewWorkflowLabel("");
      setNewOwner("");
      setNewAssignedTo("");
      setNewSourceDropIds("");
      setNewNotes("");
      setState({ message: `Created task ${json.task.id.slice(0, 8)}.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Task creation failed." });
    }
  }

  async function saveTask(task: WaveTaskRow, status?: string, patch?: Partial<TaskEdit>) {
    const edit = edits[task.id] ?? defaultEdit(task);
    const nextEdit = {
      ...edit,
      ...patch,
    };

    setState({ loading: task.id });

    try {
      const outcomeReviewChanged =
        nextEdit.outcomeScore !== (task.outcomeScore == null ? "" : String(task.outcomeScore)) ||
        nextEdit.outcomeScoreNotes !== (task.outcomeScoreNotes ?? "");
      const response = await fetch(`/api/admin/tasks/${task.id}/review`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          title: nextEdit.title,
          status: status ?? nextEdit.status,
          workflowLabel: nextEdit.workflowLabel || null,
          suggestedOwner: nextEdit.suggestedOwner || null,
          assignedTo: nextEdit.assignedTo || null,
          claimedBy: nextEdit.claimedBy || null,
          reviewerNotes: nextEdit.reviewerNotes || null,
          reviewedBy: reviewedBy || undefined,
          outcomeDropId: nextEdit.outcomeDropId,
          outcomeUrl: nextEdit.outcomeUrl,
          outcomeSummary: nextEdit.outcomeSummary,
          outcomeScore: outcomeReviewChanged ? (nextEdit.outcomeScore ? Number(nextEdit.outcomeScore) : null) : undefined,
          outcomeScoreNotes: outcomeReviewChanged ? nextEdit.outcomeScoreNotes.trim() || null : undefined,
          outcomeReviewedBy: outcomeReviewChanged ? reviewedBy || undefined : undefined,
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

  async function claimTask(task: WaveTaskRow) {
    const edit = edits[task.id] ?? defaultEdit(task);
    const claimant = reviewedBy.trim() || edit.assignedTo.trim() || edit.suggestedOwner.trim();

    if (!claimant) {
      setState({ error: "Set Reviewer, Assigned to, or Suggested owner before claiming this task." });
      return;
    }

    await saveTask(task, "in_progress", {
      assignedTo: edit.assignedTo || claimant,
      claimedBy: claimant,
    });
  }

  async function addComment(task: WaveTaskRow) {
    const body = commentDrafts[task.id]?.trim() ?? "";

    if (!body) {
      setState({ error: "Add a comment before saving it." });
      return;
    }

    setState({ loading: `${task.id}:comment` });

    try {
      const response = await fetch(`/api/admin/tasks/${task.id}/comments`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          body,
          author: reviewedBy || undefined,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(errorMessage(json));
      }

      updateCommentDraft(task.id, "");
      setState({ message: `Added comment to task ${task.id.slice(0, 8)}.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Comment creation failed." });
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
            <span className="mb-1 block">Filter status</span>
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
              App access key
            </span>
            <Input
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Optional after operator login"
            />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 lg:col-span-3">
            <span className="mb-1 block">Reviewer</span>
            <Input value={reviewedBy} onChange={(event) => setReviewedBy(event.target.value)} placeholder="operator handle" />
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

      <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Create Manual Task</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Add known work directly when it does not need a fresh summary generation pass.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.5fr_1fr_0.5fr]">
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Wave ID</span>
            <Input value={newWaveId} onChange={(event) => setNewWaveId(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Task title</span>
            <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Initial status</span>
            <Select value={newStatus} onChange={(event) => setNewStatus(event.target.value)}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Suggested owner</span>
            <Input value={newOwner} onChange={(event) => setNewOwner(event.target.value)} placeholder="optional" />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Workflow</span>
            <Select value={newWorkflowLabel} onChange={(event) => setNewWorkflowLabel(event.target.value)}>
              <WorkflowOptions currentValue={newWorkflowLabel} emptyLabel="Auto classify" />
            </Select>
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Assigned to</span>
            <Input value={newAssignedTo} onChange={(event) => setNewAssignedTo(event.target.value)} placeholder="optional" />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Source drop IDs</span>
            <Input
              value={newSourceDropIds}
              onChange={(event) => setNewSourceDropIds(event.target.value)}
              placeholder="drop-1, drop-2"
            />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 lg:col-span-3">
            <span className="mb-1 block">Notes</span>
            <Textarea className="min-h-20" value={newNotes} onChange={(event) => setNewNotes(event.target.value)} />
          </label>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={createTask} disabled={state.loading !== undefined || !newWaveId.trim() || !newTitle.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Task
          </Button>
        </div>
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
                    <Badge>workflow {task.workflowLabel ?? "unclassified"}</Badge>
                    <Badge>{task.sourceDropIds.length} sources</Badge>
                    <Badge>seen {task.seenCount}x</Badge>
                    <Badge>assigned {task.assignedTo ?? "unassigned"}</Badge>
                    <Badge>claimed {task.claimedBy ?? "unclaimed"}</Badge>
                    <Badge>outcome {task.outcomeScore == null ? "unscored" : `${task.outcomeScore}/5`}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Suggested {formatDate(task.createdAt)}
                    {task.lastSeenAt ? ` · last seen ${formatDate(task.lastSeenAt)}` : ""}
                    {task.lastSeenBriefId ? ` · latest summary ${task.lastSeenBriefId.slice(0, 8)}` : ""}
                    {task.claimedAt ? ` · claimed ${formatDate(task.claimedAt)}` : ""}
                    {task.completedAt ? ` · completed ${formatDate(task.completedAt)}` : ""}
                    {task.outcomeRecordedAt ? ` · outcome ${formatDate(task.outcomeRecordedAt)}` : ""}
                    {task.outcomeReviewedAt ? ` · scored ${formatDate(task.outcomeReviewedAt)}` : ""}
                  </p>
                </div>
                {task.brief ? (
                  <div className="max-w-xl text-sm text-zinc-700 dark:text-zinc-300">
                    <p className="font-semibold text-zinc-950 dark:text-zinc-50">From summary</p>
                    <p>{task.brief.title}</p>
                    <p className="text-zinc-500 dark:text-zinc-500">
                      {task.brief.status}
                      {task.brief.postDropId ? ` · posted ${task.brief.postDropId}` : ""}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.45fr_0.45fr]">
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="mb-1 block">Task</span>
                  <Input value={edit.title} onChange={(event) => updateEdit(task.id, { title: event.target.value })} />
                </label>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="mb-1 block">Suggested owner</span>
                  <Input
                    value={edit.suggestedOwner}
                    onChange={(event) => updateEdit(task.id, { suggestedOwner: event.target.value })}
                    placeholder="agent suggestion"
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
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="mb-1 block">Workflow</span>
                  <Select value={edit.workflowLabel} onChange={(event) => updateEdit(task.id, { workflowLabel: event.target.value })}>
                    <WorkflowOptions currentValue={edit.workflowLabel} emptyLabel="Unclassified" />
                  </Select>
                </label>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="mb-1 block">Assigned to</span>
                  <Input
                    value={edit.assignedTo}
                    onChange={(event) => updateEdit(task.id, { assignedTo: event.target.value })}
                    placeholder="human owner"
                  />
                </label>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="mb-1 block">Claimed by</span>
                  <Input
                    value={edit.claimedBy}
                    onChange={(event) => updateEdit(task.id, { claimedBy: event.target.value })}
                    placeholder="person or agent"
                  />
                </label>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 lg:col-span-3">
                  <span className="mb-1 block">Reviewer notes</span>
                  <Textarea
                    className="min-h-24"
                    value={edit.reviewerNotes}
                    onChange={(event) => updateEdit(task.id, { reviewerNotes: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="mb-1 block">Outcome drop ID</span>
                  <Input
                    value={edit.outcomeDropId}
                    onChange={(event) => updateEdit(task.id, { outcomeDropId: event.target.value })}
                    placeholder="optional 6529 drop"
                  />
                </label>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 lg:col-span-2">
                  <span className="mb-1 block">Outcome URL</span>
                  <Input
                    value={edit.outcomeUrl}
                    onChange={(event) => updateEdit(task.id, { outcomeUrl: event.target.value })}
                    placeholder="https://..."
                  />
                </label>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 lg:col-span-3">
                  <span className="mb-1 block">Outcome summary</span>
                  <Textarea
                    className="min-h-20"
                    value={edit.outcomeSummary}
                    onChange={(event) => updateEdit(task.id, { outcomeSummary: event.target.value })}
                  />
                </label>
                <div className="grid gap-4 lg:col-span-3 sm:grid-cols-[0.4fr_1fr]">
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="mb-1 flex items-center gap-1.5">
                      <Star className="h-4 w-4" aria-hidden="true" />
                      Outcome score
                    </span>
                    <Select
                      value={edit.outcomeScore}
                      onChange={(event) => updateEdit(task.id, { outcomeScore: event.target.value })}
                    >
                      <option value="">Unscored</option>
                      <option value="5">5 - high value</option>
                      <option value="4">4 - useful</option>
                      <option value="3">3 - acceptable</option>
                      <option value="2">2 - weak</option>
                      <option value="1">1 - no useful outcome</option>
                    </Select>
                  </label>
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="mb-1 block">Outcome score notes</span>
                    <Input
                      value={edit.outcomeScoreNotes}
                      onChange={(event) => updateEdit(task.id, { outcomeScoreNotes: event.target.value })}
                      placeholder="Why this score?"
                    />
                  </label>
                </div>
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
                <Button type="button" variant="secondary" onClick={() => claimTask(task)} disabled={state.loading !== undefined || !edit.title.trim()}>
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Claim
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
              {task.outcomeDropId || task.outcomeUrl || task.outcomeSummary || task.outcomeScore != null || task.outcomeScoreNotes ? (
                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <p className="font-semibold">Recorded outcome</p>
                  {task.outcomeSummary ? <p className="mt-1">{task.outcomeSummary}</p> : null}
                  {task.outcomeDropId ? <p className="mt-1">Drop: {task.outcomeDropId}</p> : null}
                  {task.outcomeUrl ? <p className="mt-1">URL: {task.outcomeUrl}</p> : null}
                  {task.outcomeScore == null ? null : (
                    <p className="mt-1">
                      Score: {task.outcomeScore}/5
                      {task.outcomeReviewedBy ? ` by ${task.outcomeReviewedBy}` : ""}
                    </p>
                  )}
                  {task.outcomeScoreNotes ? <p className="mt-1">Score notes: {task.outcomeScoreNotes}</p> : null}
                </div>
              ) : null}
              <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Task Comments
                </h3>
                {task.comments.length ? (
                  <ol className="mt-3 space-y-3">
                    {task.comments.map((comment) => (
                      <li key={comment.id} className="rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{comment.body}</p>
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                          {formatDate(comment.createdAt)}
                          {comment.author ? ` by ${comment.author}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No task comments yet.</p>
                )}
                <div className="mt-3 grid gap-2">
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="mb-1 block">Add comment</span>
                    <Textarea
                      className="min-h-20"
                      value={commentDrafts[task.id] ?? ""}
                      onChange={(event) => updateCommentDraft(task.id, event.target.value)}
                      placeholder="Add a dated follow-up note or handoff detail."
                    />
                  </label>
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => addComment(task)}
                      disabled={state.loading !== undefined || !(commentDrafts[task.id]?.trim())}
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      Add Comment
                    </Button>
                  </div>
                </div>
              </div>
              <EntityHistoryList events={task.history} emptyText="No task changes recorded yet." />
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
