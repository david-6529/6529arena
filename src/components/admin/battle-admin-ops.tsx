"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, KeyRound, Plus, Send, Trophy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiState = {
  loading?: "import" | "close" | "preview" | "post";
  error?: string;
  message?: string;
};

type PostPreview = {
  battleUrl: string;
  content: string;
  contentLength: number;
};

function toVoteBatch({
  battleId,
  batchId,
  source,
  countA,
  countB,
}: {
  battleId: string;
  batchId: string;
  source: string;
  countA: number;
  countB: number;
}) {
  const stableBatchId = batchId || `manual-${Date.now()}`;
  const votes = [];

  for (let index = 0; index < countA; index += 1) {
    votes.push({
      selectedLabel: "A",
      source,
      externalId: `${battleId}:${stableBatchId}:A:${index + 1}`,
    });
  }

  for (let index = 0; index < countB; index += 1) {
    votes.push({
      selectedLabel: "B",
      source,
      externalId: `${battleId}:${stableBatchId}:B:${index + 1}`,
    });
  }

  return votes;
}

export function BattleAdminOps({ initialBattleId = "" }: { initialBattleId?: string }) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [battleId, setBattleId] = useState(initialBattleId);
  const [source, setSource] = useState("6529_manual");
  const [batchId, setBatchId] = useState("");
  const [countA, setCountA] = useState("");
  const [countB, setCountB] = useState("");
  const [allowClosed, setAllowClosed] = useState(false);
  const [createPoll, setCreatePoll] = useState(false);
  const [pollClosingHours, setPollClosingHours] = useState("24");
  const [postPreview, setPostPreview] = useState<PostPreview | null>(null);
  const [state, setState] = useState<ApiState>({});

  function headers() {
    return {
      "content-type": "application/json",
      ...(adminKey ? { "x-admin-api-key": adminKey } : {}),
    };
  }

  async function importVotes() {
    const a = Number(countA || 0);
    const b = Number(countB || 0);
    const votes = toVoteBatch({
      battleId,
      batchId,
      source,
      countA: Number.isFinite(a) ? a : 0,
      countB: Number.isFinite(b) ? b : 0,
    });

    if (!battleId || !votes.length) {
      setState({ error: "Enter a battle ID and at least one A or B vote." });
      return;
    }

    setState({ loading: "import" });

    try {
      const response = await fetch(`/api/admin/battles/${battleId}/votes/import`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          votes,
          allowClosed,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.errorId ? `${json.error} (${json.errorId})` : json.error ?? "Vote import failed.");
      }

      setState({ message: `Imported ${json.imported} votes.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Vote import failed." });
    }
  }

  async function closeBattle() {
    if (!battleId) {
      setState({ error: "Enter a battle ID to close." });
      return;
    }

    setState({ loading: "close" });

    try {
      const response = await fetch(`/api/battles/${battleId}/close`, {
        method: "POST",
        headers: headers(),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.errorId ? `${json.error} (${json.errorId})` : json.error ?? "Close failed.");
      }

      setState({ message: `Closed battle ${battleId.slice(0, 8)}.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Close failed." });
    }
  }

  async function postTo6529() {
    if (!battleId) {
      setState({ error: "Enter a battle ID to post." });
      return;
    }

    setState({ loading: "post" });

    try {
      const hours = Number(pollClosingHours || 24);
      const response = await fetch(`/api/battles/${battleId}/post-to-6529`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          createPoll,
          pollClosingHours: Number.isFinite(hours) ? hours : 24,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.errorId ? `${json.error} (${json.errorId})` : json.error ?? "Post failed.");
      }

      setState({ message: `Posted battle ${battleId.slice(0, 8)} to 6529.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Post failed." });
    }
  }

  async function previewPost() {
    if (!battleId) {
      setState({ error: "Enter a battle ID to preview." });
      return;
    }

    setState({ loading: "preview" });

    try {
      const response = await fetch(`/api/battles/${battleId}/post-to-6529`, {
        method: "GET",
        headers: adminKey ? { "x-admin-api-key": adminKey } : undefined,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.errorId ? `${json.error} (${json.errorId})` : json.error ?? "Preview failed.");
      }

      setPostPreview(json.preview);
      setState({ message: `Rendered ${json.preview.contentLength} characters for 6529 posting.` });
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Preview failed." });
    }
  }

  return (
    <section className="mb-6 rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Battle Operations</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Import manual 6529 vote counts, then close the battle to calculate the winner and leaderboard scores.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_0.7fr_0.7fr]">
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
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">Battle ID</span>
          <Input value={battleId} onChange={(event) => setBattleId(event.target.value)} placeholder="cuid" />
        </label>
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">Batch ID</span>
          <Input
            value={batchId}
            onChange={(event) => setBatchId(event.target.value)}
            placeholder="wave-replies-001"
          />
        </label>
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">Votes A</span>
          <Input
            type="number"
            min={0}
            max={500}
            value={countA}
            onChange={(event) => setCountA(event.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">Votes B</span>
          <Input
            type="number"
            min={0}
            max={500}
            value={countB}
            onChange={(event) => setCountB(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">Vote source</span>
          <Input value={source} onChange={(event) => setSource(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={allowClosed}
            onChange={(event) => setAllowClosed(event.target.checked)}
          />
          Allow closed imports
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={state.loading !== undefined} onClick={importVotes}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {state.loading === "import" ? "Importing" : "Import Votes"}
          </Button>
          <Button type="button" disabled={state.loading !== undefined} onClick={closeBattle}>
            <Trophy className="h-4 w-4" aria-hidden="true" />
            {state.loading === "close" ? "Closing" : "Close Battle"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 md:grid-cols-[1fr_0.6fr_auto_auto] md:items-end">
        <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={createPoll}
            onChange={(event) => setCreatePoll(event.target.checked)}
          />
          Create 6529 poll drop
        </label>
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">Poll closes in hours</span>
          <Input
            type="number"
            min={1}
            max={336}
            value={pollClosingHours}
            onChange={(event) => setPollClosingHours(event.target.value)}
          />
        </label>
        <Button type="button" variant="secondary" disabled={state.loading !== undefined} onClick={previewPost}>
          <Eye className="h-4 w-4" aria-hidden="true" />
          {state.loading === "preview" ? "Rendering" : "Preview Post"}
        </Button>
        <Button type="button" variant="secondary" disabled={state.loading !== undefined} onClick={postTo6529}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {state.loading === "post" ? "Posting" : "Post to 6529"}
        </Button>
      </div>

      {postPreview ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">6529 Post Preview</h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              {postPreview.contentLength} chars · {postPreview.battleUrl}
            </span>
          </div>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-3 text-sm leading-6 text-zinc-800 dark:border-zinc-800 dark:bg-black dark:text-zinc-200">
            {postPreview.content}
          </pre>
        </div>
      ) : null}

      {state.error ? (
        <p aria-live="polite" className="mt-3 rounded-md border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{state.error}</p>
      ) : null}
      {state.message ? (
        <p aria-live="polite" className="mt-3 flex items-center gap-2 rounded-md border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
