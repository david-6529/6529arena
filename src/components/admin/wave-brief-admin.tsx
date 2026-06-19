"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, FileText, KeyRound, Plus, Send, Star, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { EntityHistoryList, type EntityHistoryEventRow } from "@/components/admin/entity-history-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { hasUnsavedPostContentChanges, isWaveBriefApprovalBlocked, isWaveBriefContentLocked } from "@/lib/briefs/draft-state";
import { formatDate, formatLatency, formatUsd } from "@/lib/format";

type SourceCheck = {
  totalDrops: number;
  referencedDropIds: string[];
  missingDropIds: string[];
  references: Array<{
    dropId: string;
    path: string;
    section: string;
  }>;
  missingReferences: Array<{
    dropId: string;
    path: string;
    section: string;
  }>;
};

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
  humanScore: number | null;
  humanScoreNotes: string | null;
  reviewedBy: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  postDropId: string | null;
  postedAt: string | null;
  createdAt: string;
  previousBrief: {
    id: string;
    title: string;
    status: string;
    postDropId: string | null;
    createdAt: string;
  } | null;
  sourceWaves: Array<{
    waveId: string;
    name: string | null;
    label: string | null;
    primary: boolean;
    dropCount: number | null;
    searchedMessages: number | null;
  }>;
  sourceCheck: SourceCheck;
  contentSourceCheck: SourceCheck;
  quality: {
    score: number;
    label: "ready" | "review" | "weak";
    blockers: string[];
    strengths: string[];
  };
  history: EntityHistoryEventRow[];
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
  humanScore: string;
  humanScoreNotes: string;
};

type PostPreview = {
  briefId: string;
  waveId: string;
  status: string;
  postDropId: string | null;
  content: string;
  contentLength: number;
  sourceCheck: SourceCheck;
};

type WaveSearchOption = {
  id: string;
  name: string;
  description: string | null;
  source: string;
};

function extractWaveId(value: string) {
  const trimmed = value.trim();
  const waveUrlMatch = trimmed.match(/\/waves\/([^/?#\s]+)/);

  return (waveUrlMatch?.[1] ?? trimmed).trim();
}

function parseRelatedWaves(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipeIndex = line.indexOf("|");

      if (pipeIndex >= 0) {
        return {
          label: line.slice(0, pipeIndex).trim() || undefined,
          waveId: extractWaveId(line.slice(pipeIndex + 1)),
        };
      }

      return {
        waveId: extractWaveId(line),
      };
    })
    .filter((wave) => wave.waveId);
}

function defaultDraft(brief: WaveBriefRow): Draft {
  return {
    title: brief.title,
    content: brief.content,
    reviewerNotes: brief.reviewerNotes ?? "",
    humanScore: brief.humanScore == null ? "" : String(brief.humanScore),
    humanScoreNotes: brief.humanScoreNotes ?? "",
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

function sourceWaveLabel(source: WaveBriefRow["sourceWaves"][number]) {
  const name = source.name ?? source.waveId;
  const role = source.label && source.label !== name ? ` · ${source.label}` : "";
  const count = source.dropCount == null ? "" : ` · ${source.dropCount} drops`;

  return `${name}${role}${count}`;
}

export function WaveBriefAdmin({ briefs }: { briefs: WaveBriefRow[] }) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [waveId, setWaveId] = useState("");
  const [waveQuery, setWaveQuery] = useState("");
  const [waveOptions, setWaveOptions] = useState<WaveSearchOption[]>([]);
  const [wavePickerOpen, setWavePickerOpen] = useState(false);
  const [waveSearchState, setWaveSearchState] = useState<ApiState>({});
  const [relatedWavesText, setRelatedWavesText] = useState("");
  const [requestText, setRequestText] = useState("Create a clear catch-up summary for this 6529 wave and any related waves.");
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

  useEffect(() => {
    const query = waveQuery.trim();

    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setWaveSearchState({ loading: "search" });

      try {
        const response = await fetch(`/api/admin/6529/waves/search?q=${encodeURIComponent(query)}&limit=8`, {
          headers: adminKey ? { "x-admin-api-key": adminKey } : undefined,
          signal: controller.signal,
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(errorMessage(json));
        }

        setWaveOptions(Array.isArray(json.waves) ? json.waves : []);
        setWaveSearchState({});
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setWaveOptions([]);
        setWaveSearchState({ error: error instanceof Error ? error.message : "Wave search failed." });
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [adminKey, waveQuery]);

  function updateDraft(briefId: string, patch: Partial<Draft>) {
    if ("title" in patch || "content" in patch) {
      setPreviewById((current) => {
        const next = { ...current };
        delete next[briefId];
        return next;
      });
    }

    setDrafts((current) => ({
      ...current,
      [briefId]: {
        ...current[briefId],
        ...patch,
      },
    }));
  }

  function updateWaveQuery(value: string) {
    setWaveQuery(value);
    setWavePickerOpen(true);

    if (value.trim().length < 2) {
      setWaveOptions([]);
      setWaveSearchState({});
    }
  }

  function selectWave(option: WaveSearchOption) {
    setWaveQuery(option.name);
    setWaveId(option.id);
    setWavePickerOpen(false);
  }

  async function generateBrief() {
    setState({ loading: "generate" });

    try {
      const relatedWaves = parseRelatedWaves(relatedWavesText);
      const response = await fetch("/api/admin/briefs", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          waveId,
          relatedWaves: relatedWaves.length ? relatedWaves : undefined,
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

      setState({ message: `Generated summary ${json.brief.id.slice(0, 8)}.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Summary generation failed." });
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
          reviewerNotes: draft.reviewerNotes.trim() || null,
          humanScore: draft.humanScore ? Number(draft.humanScore) : null,
          humanScoreNotes: draft.humanScoreNotes.trim() || null,
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

      setState({ message: `Posted summary ${brief.id.slice(0, 8)} to 6529.` });
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
            <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Generate Wave Summary</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Create an operator-reviewed summary from 6529 wave context. Review, score 1-5, and approve after the source gate passes.
            </p>
          </div>
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
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="relative block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <label htmlFor="wave-search" className="mb-1 block">Wave name</label>
            <Input
              id="wave-search"
              value={waveQuery}
              onChange={(event) => updateWaveQuery(event.target.value)}
              onFocus={() => setWavePickerOpen(true)}
              onBlur={() => window.setTimeout(() => setWavePickerOpen(false), 120)}
              placeholder="Search saved waves"
              autoComplete="off"
            />
            {wavePickerOpen && (waveSearchState.loading === "search" || waveSearchState.error || waveOptions.length > 0) ? (
              <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
                {waveSearchState.loading === "search" ? (
                  <p className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Searching waves</p>
                ) : null}
                {waveSearchState.error ? (
                  <p className="px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">{waveSearchState.error}</p>
                ) : null}
                {waveOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="block w-full cursor-pointer border-t border-zinc-100 px-3 py-2 text-left transition hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectWave(option)}
                  >
                    <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{option.name}</span>
                    <span className="mt-0.5 block truncate font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {option.id} · {option.source}
                    </span>
                    {option.description ? (
                      <span className="mt-1 line-clamp-2 block text-xs font-medium leading-5 text-zinc-500 dark:text-zinc-400">
                        {option.description}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            {waveId.trim() ? (
              <p className="mt-2 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Selected wave ID <span className="font-mono text-zinc-700 dark:text-zinc-300">{waveId.trim()}</span>
              </p>
            ) : null}
          </div>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="mb-1 block">Wave ID</span>
            <Input
              value={waveId}
              onChange={(event) => setWaveId(event.target.value)}
              placeholder="Paste wave ID"
            />
          </label>
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 lg:col-span-4">
            <span className="mb-1 block">Related waves</span>
            <Textarea
              className="min-h-24"
              value={relatedWavesText}
              onChange={(event) => setRelatedWavesText(event.target.value)}
              placeholder="Raw PR feed | https://6529.io/waves/..."
            />
            <span className="mt-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Optional. Add one wave URL or ID per line; use <code>label | wave URL</code> when the source needs a role.
            </span>
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
          <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 lg:col-span-4">
            <span className="mb-1 block">Summary request</span>
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
            <span className="mb-1 block">Max messages total</span>
            <Input
              type="number"
              min={1}
              max={5000}
              value={maxMessages}
              onChange={(event) => setMaxMessages(event.target.value)}
              placeholder="500 total"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={generateBrief} disabled={state.loading !== undefined || !waveId.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {state.loading === "generate" ? "Generating" : "Generate Summary"}
          </Button>
          <label className="block min-w-64 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
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

      <section className="grid gap-4">
        {briefs.map((brief) => {
          const draft = drafts[brief.id] ?? defaultDraft(brief);
          const preview = previewById[brief.id];
          const isRejected = brief.status === "rejected";
          const isPosting = brief.status === "posting";
          const isContentLocked = isWaveBriefContentLocked(brief.status);
          const isPostGateBlocked = brief.contentSourceCheck.missingDropIds.length > 0;
          const hasUnsavedPostChanges = hasUnsavedPostContentChanges({
            savedTitle: brief.title,
            savedContent: brief.content,
            draftTitle: draft.title,
            draftContent: draft.content,
          });
          const willInvalidateApproval = brief.status === "approved" && hasUnsavedPostChanges;
          const isApprovalBlocked = isWaveBriefApprovalBlocked({
            status: brief.status,
            finalMissingSourceCount: brief.contentSourceCheck.missingDropIds.length,
            hasUnsavedContentChanges: hasUnsavedPostChanges,
          });

          return (
            <article id={brief.id} key={brief.id} className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
                    <Badge
                      className={
                        isPostGateBlocked
                          ? "border-red-800 bg-red-950/40 text-red-200"
                          : "border-emerald-800 bg-emerald-950/40 text-emerald-200"
                      }
                    >
                      {isPostGateBlocked ? `${brief.contentSourceCheck.missingDropIds.length} post blocked` : "post gate clear"}
                    </Badge>
                    <Badge className={qualityClass(brief.quality.label)}>
                      quality {brief.quality.score}
                    </Badge>
                    <Badge className="border-sky-800 bg-sky-950/40 text-sky-200">
                      human {brief.humanScore == null ? "unscored" : `${brief.humanScore}/5`}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-zinc-950 dark:text-zinc-50">{brief.title}</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Wave {brief.waveId} · {formatDate(brief.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                    {brief.previousBrief
                      ? `Continues ${brief.previousBrief.title} (${brief.previousBrief.status}, ${formatDate(brief.previousBrief.createdAt)})`
                      : "First reviewed summary lineage for this wave."}
                  </p>
                  {brief.sourceWaves.length ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-500">Source waves</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {brief.sourceWaves.map((source) => (
                          <a
                            key={source.waveId}
                            href={`https://6529.io/waves/${source.waveId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer rounded-md border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-950"
                          >
                            {sourceWaveLabel(source)}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
                    <Input
                      value={draft.title}
                      onChange={(event) => updateDraft(brief.id, { title: event.target.value })}
                      disabled={isContentLocked}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="mb-1 block">Reviewer notes</span>
                    <Textarea
                      className="min-h-28"
                      value={draft.reviewerNotes}
                      onChange={(event) => updateDraft(brief.id, { reviewerNotes: event.target.value })}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-[0.45fr_1fr]">
                    <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      <span className="mb-1 flex items-center gap-1.5">
                        <Star className="h-4 w-4" aria-hidden="true" />
                        Human score
                      </span>
                      <Select
                        value={draft.humanScore}
                        onChange={(event) => updateDraft(brief.id, { humanScore: event.target.value })}
                      >
                        <option value="">Unscored</option>
                        <option value="5">5 - ready</option>
                        <option value="4">4 - minor edits</option>
                        <option value="3">3 - useful but needs work</option>
                        <option value="2">2 - weak</option>
                        <option value="1">1 - unusable</option>
                      </Select>
                    </label>
                    <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      <span className="mb-1 block">Score notes</span>
                      <Input
                        value={draft.humanScoreNotes}
                        onChange={(event) => updateDraft(brief.id, { humanScoreNotes: event.target.value })}
                        placeholder="Why this score?"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => reviewBrief(brief, "update")} disabled={state.loading !== undefined}>
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Save Edits
                    </Button>
                    <Button type="button" onClick={() => reviewBrief(brief, "approve")} disabled={state.loading !== undefined || isApprovalBlocked}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => reviewBrief(brief, "reject")}
                      disabled={state.loading !== undefined || isContentLocked}
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Reject
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => previewPost(brief)}
                      disabled={state.loading !== undefined || brief.status === "rejected" || hasUnsavedPostChanges}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      Preview Post
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => postBrief(brief)}
                      disabled={state.loading !== undefined || brief.status !== "approved" || isPostGateBlocked || hasUnsavedPostChanges}
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Post to 6529
                    </Button>
                  </div>
                  {hasUnsavedPostChanges ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      Save edits before approving, previewing, or posting.
                      {willInvalidateApproval ? " Saving title or content changes will move this summary back to draft until it is approved again." : ""}
                    </p>
                  ) : null}
                  {brief.postDropId ? (
                    <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                      <p>
                        Posted as drop {brief.postDropId}{brief.postedAt ? ` on ${formatDate(brief.postedAt)}` : ""}.
                      </p>
                      <p>Posted title and content are locked. Review notes and scores can still be updated.</p>
                    </div>
                  ) : null}
                  {isRejected ? (
                    <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                      Rejected summary content is locked. Create a new summary for revisions; notes and scores can still be updated.
                    </p>
                  ) : null}
                  {isPosting ? (
                    <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                      6529 posting is in progress. Title and content are locked until the post finishes or fails.
                    </p>
                  ) : null}
                  {isPostGateBlocked ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                      <p className="font-semibold">Final source gate blocked</p>
                      <p className="mt-1">Save edits after removing or correcting these source references before approval or posting.</p>
                      <ul className="mt-2 space-y-1">
                        {brief.contentSourceCheck.missingReferences.map((reference) => (
                          <li key={`${reference.path}:${reference.dropId}`}>
                            {reference.dropId} in {reference.section}
                            <span className="block text-xs text-red-700 dark:text-red-300">{reference.path}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                      Post source gate is clear for the saved summary content.
                    </p>
                  )}
                  {brief.sourceCheck.missingDropIds.length ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                      <p className="font-semibold">Generated summary missing source drops</p>
                      <ul className="mt-1 space-y-1">
                        {brief.sourceCheck.missingReferences.map((reference) => (
                          <li key={`${reference.path}:${reference.dropId}`}>
                            {reference.dropId} in {reference.section}
                            <span className="block text-xs text-red-700 dark:text-red-300">{reference.path}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {brief.sourceCheck.references.length} source references across {brief.sourceCheck.referencedDropIds.length} cited drops found in{" "}
                      {brief.sourceCheck.totalDrops} stored context drops.
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
                      Summary quality checks are ready for human review.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="mb-1 block">Summary content</span>
                    <Textarea
                      className="min-h-[520px] font-mono text-xs"
                      value={draft.content}
                      onChange={(event) => updateDraft(brief.id, { content: event.target.value })}
                      disabled={isContentLocked}
                    />
                  </label>
                  {preview ? (
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">6529 Post Preview</h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={
                              preview.sourceCheck.missingDropIds.length
                                ? "border-red-800 bg-red-950/40 text-red-200"
                                : "border-emerald-800 bg-emerald-950/40 text-emerald-200"
                            }
                          >
                            {preview.sourceCheck.missingDropIds.length
                              ? `${preview.sourceCheck.missingDropIds.length} missing sources`
                              : "source gate clear"}
                          </Badge>
                          <span className="text-xs text-zinc-500 dark:text-zinc-500">{preview.contentLength} chars</span>
                        </div>
                      </div>
                      {preview.sourceCheck.missingReferences.length ? (
                        <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                          {preview.sourceCheck.missingReferences.map((reference) => (
                            <p key={`${reference.path}:${reference.dropId}`}>
                              {reference.dropId} in {reference.section}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-800 dark:border-zinc-800 dark:bg-black dark:text-zinc-200">
                        {preview.content}
                      </pre>
                    </div>
                  ) : null}
                </div>
              </div>
              <EntityHistoryList events={brief.history} emptyText="No summary changes recorded yet." />
            </article>
          );
        })}
        {!briefs.length ? (
          <div className="rounded-md border border-zinc-200 bg-white px-5 py-8 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            No wave summaries generated yet.
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
