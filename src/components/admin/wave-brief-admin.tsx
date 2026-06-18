"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, FileText, KeyRound, Plus, Send, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatLatency, formatUsd } from "@/lib/format";

export type WaveBriefRow = {
  id: string;
  waveId: string;
  triggerDropId: string | null;
  status: string;
  title: string;
  requestText: string;
  content: string;
  provider: string;
  modelName: string;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  reviewerNotes: string | null;
  reviewedBy: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  postDropId: string | null;
  postedAt: string | null;
  createdAt: string;
  sourceCheck: {
    totalDrops: number;
    referencedDropIds: string[];
    missingDropIds: string[];
  };
  quality: {
    score: number;
    label: "ready" | "review" | "weak";
    blockers: string[];
    strengths: string[];
  };
};

type ApiState = {
  loading?: string;
  error?: string;
  message?: string;
};

type Draft = {
  title: string;
  content: string;
  reviewerNotes: string;
};

type PostPreview = {
  briefId: string;
  waveId: string;
  status: string;
  postDropId: string | null;
  content: string;
  contentLength: number;
};

function defaultDraft(brief: WaveBriefRow): Draft {
  return {
    title: brief.title,
    content: brief.content,
    reviewerNotes: brief.reviewerNotes ?? "",
  };
}

function statusClass(status: string) {
  if (status === "approved") {
    return "border-emerald-800 bg-emerald-950/40 text-emerald-200";
  }

  if (status === "posted") {
    return "border-cyan-800 bg-cyan-950/40 text-cyan-200";
  }

  if (status === "rejected") {
    return "border-red-800 bg-red-950/40 text-red-200";
  }

  return "border-amber-800 bg-amber-950/40 text-amber-200";
}

function qualityClass(label: WaveBriefRow["quality"]["label"]) {
  if (label === "ready") {
    return "border-emerald-800 bg-emerald-950/40 text-emerald-200";
  }

  if (label === "weak") {
    return "border-red-800 bg-red-950/40 text-red-200";
  }

  return "border-amber-800 bg-amber-950/40 text-amber-200";
}

function errorMessage(payload: { error?: string; errorId?: string }) {
  return payload.errorId ? `${payload.error ?? "Request failed."} (${payload.errorId})` : payload.error ?? "Request failed.";
}

export function WaveBriefAdmin({ briefs }: { briefs: WaveBriefRow[] }) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [waveId, setWaveId] = useState("");
  const [requestText, setRequestText] = useState("Create an operator-ready brief for this 6529 wave.");
  const [contextFrom, setContextFrom] = useState("");
  const [contextTo, setContextTo] = useState("");
  const [maxMessages, setMaxMessages] = useState("");
  const [provider, setProvider] = useState("openai");
  const [modelName, setModelName] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(briefs.map((brief) => [brief.id, defaultDraft(brief)])),
  );
  const [previewById, setPreviewById] = useState<Record<string, PostPreview>>({});
  const [state, setState] = useState<ApiState>({});

  function headers() {
    return {
      "content-type": "application/json",
      ...(adminKey ? { "x-admin-api-key": adminKey } : {}),
    };
  }

  function updateDraft(briefId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [briefId]: {
        ...current[briefId],
        ...patch,
      },
    }));
  }

  async function generateBrief() {
    setState({ loading: "generate" });

    try {
      const response = await fetch("/api/admin/briefs", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          waveId,
          requestText,
          contextFrom: contextFrom ? new Date(contextFrom).toISOString() : undefined,
          contextTo: contextTo ? new Date(contextTo).toISOString() : undefined,
          maxMessages: maxMessages ? Number(maxMessages) : undefined,
          provider,
          modelName: modelName || undefined,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(errorMessage(json));
      }

      setState({ message: `Generated brief ${json.brief.id.slice(0, 8)}.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Brief generation failed." });
    }
  }

  async function reviewBrief(brief: WaveBriefRow, action: "approve" | "reject" | "update") {
    const draft = drafts[brief.id] ?? defaultDraft(brief);

    setState({ loading: `${brief.id}:${action}` });

    try {
      const response = await fetch(`/api/admin/briefs/${brief.id}/review`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          action,
          title: draft.title,
          content: draft.content,
          reviewerNotes: draft.reviewerNotes || undefined,
          reviewedBy: reviewedBy || undefined,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(errorMessage(json));
      }

      setState({ message: `${action === "update" ? "Updated" : action === "approve" ? "Approved" : "Rejected"} ${brief.title}.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Review failed." });
    }
  }

  async function previewPost(brief: WaveBriefRow) {
    setState({ loading: `${brief.id}:preview` });

    try {
      const response = await fetch(`/api/admin/briefs/${brief.id}/post-to-6529`, {
        headers: adminKey ? { "x-admin-api-key": adminKey } : undefined,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(errorMessage(json));
      }

      setPreviewById((current) => ({ ...current, [brief.id]: json.preview }));
      setState({ message: `Rendered ${json.preview.contentLength} characters for 6529 posting.` });
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Preview failed." });
    }
  }

  async function postBrief(brief: WaveBriefRow) {
    setState({ loading: `${brief.id}:post` });

    try {
      const response = await fetch(`/api/admin/briefs/${brief.id}/post-to-6529`, {
        method: "POST",
        headers: headers(),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(errorMessage(json));
      }

      setState({ message: `Posted brief ${brief.id.slice(0, 8)} to 6529.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Post failed." });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 grid gap-3 border-b border-zinc-200 pb-5 dark:border-zinc-800 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Generate Wave Brief</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Create an admin-only draft brief from 6529 wave context. Review and approve before posting.
            </p>
          </div>
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
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Wave ID</span>
            <Input value={waveId} onChange={(event) => setWaveId(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Provider</span>
            <Select value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google Gemini</option>
            </Select>
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Model override</span>
            <Input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="default for provider" />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 lg:col-span-3">
            <span className="mb-1 block">Brief request</span>
            <Textarea value={requestText} onChange={(event) => setRequestText(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">From</span>
            <Input type="datetime-local" value={contextFrom} onChange={(event) => setContextFrom(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">To</span>
            <Input type="datetime-local" value={contextTo} onChange={(event) => setContextTo(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Max messages</span>
            <Input
              type="number"
              min={1}
              max={5000}
              value={maxMessages}
              onChange={(event) => setMaxMessages(event.target.value)}
              placeholder="500"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={generateBrief} disabled={state.loading !== undefined || !waveId.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {state.loading === "generate" ? "Generating" : "Generate Brief"}
          </Button>
          <label className="block min-w-64 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
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
        {briefs.map((brief) => {
          const draft = drafts[brief.id] ?? defaultDraft(brief);
          const preview = previewById[brief.id];

          return (
            <article key={brief.id} className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={statusClass(brief.status)}>{brief.status}</Badge>
                    <Badge>{brief.provider}/{brief.modelName}</Badge>
                    <Badge
                      className={
                        brief.sourceCheck.missingDropIds.length
                          ? "border-red-800 bg-red-950/40 text-red-200"
                          : "border-emerald-800 bg-emerald-950/40 text-emerald-200"
                      }
                    >
                      {brief.sourceCheck.missingDropIds.length
                        ? `${brief.sourceCheck.missingDropIds.length} missing sources`
                        : "sources ok"}
                    </Badge>
                    <Badge className={qualityClass(brief.quality.label)}>
                      quality {brief.quality.score}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-zinc-950 dark:text-zinc-50">{brief.title}</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Wave {brief.waveId} · {formatDate(brief.createdAt)}
                  </p>
                </div>
                <div className="grid gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-4">
                  <Metric label="Cost" value={formatUsd(brief.costUsd)} />
                  <Metric label="Latency" value={formatLatency(brief.latencyMs)} />
                  <Metric label="Input" value={brief.promptTokens == null ? "n/a" : String(brief.promptTokens)} />
                  <Metric label="Output" value={brief.completionTokens == null ? "n/a" : String(brief.completionTokens)} />
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="mb-1 block">Title</span>
                    <Input value={draft.title} onChange={(event) => updateDraft(brief.id, { title: event.target.value })} />
                  </label>
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="mb-1 block">Reviewer notes</span>
                    <Textarea
                      className="min-h-28"
                      value={draft.reviewerNotes}
                      onChange={(event) => updateDraft(brief.id, { reviewerNotes: event.target.value })}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => reviewBrief(brief, "update")} disabled={state.loading !== undefined}>
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Save Edits
                    </Button>
                    <Button type="button" onClick={() => reviewBrief(brief, "approve")} disabled={state.loading !== undefined || brief.status === "posted"}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Approve
                    </Button>
                    <Button type="button" variant="danger" onClick={() => reviewBrief(brief, "reject")} disabled={state.loading !== undefined || brief.status === "posted"}>
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Reject
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => previewPost(brief)} disabled={state.loading !== undefined || brief.status === "rejected"}>
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      Preview Post
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => postBrief(brief)} disabled={state.loading !== undefined || brief.status !== "approved"}>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Post to 6529
                    </Button>
                  </div>
                  {brief.postDropId ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Posted as drop {brief.postDropId}{brief.postedAt ? ` on ${formatDate(brief.postedAt)}` : ""}.
                    </p>
                  ) : null}
                  {brief.sourceCheck.missingDropIds.length ? (
                    <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                      Missing source drops: {brief.sourceCheck.missingDropIds.join(", ")}
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {brief.sourceCheck.referencedDropIds.length} cited drops found in {brief.sourceCheck.totalDrops} stored context drops.
                    </p>
                  )}
                  {brief.quality.blockers.length ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      <p className="font-semibold">Review notes</p>
                      <ul className="mt-1 list-inside list-disc space-y-1">
                        {brief.quality.blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                      Brief quality checks are ready for human review.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="mb-1 block">Brief content</span>
                    <Textarea
                      className="min-h-[520px] font-mono text-xs"
                      value={draft.content}
                      onChange={(event) => updateDraft(brief.id, { content: event.target.value })}
                    />
                  </label>
                  {preview ? (
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">6529 Post Preview</h3>
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">{preview.contentLength} chars</span>
                      </div>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-800 dark:border-zinc-800 dark:bg-black dark:text-zinc-200">
                        {preview.content}
                      </pre>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
        {!briefs.length ? (
          <div className="rounded-md border border-zinc-200 bg-white px-5 py-8 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            No wave briefs generated yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-zinc-500 dark:text-zinc-500">{label}</dt>
      <dd className="font-semibold text-zinc-950 dark:text-zinc-50">{value}</dd>
    </div>
  );
}
