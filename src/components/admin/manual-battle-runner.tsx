"use client";

import { AlertTriangle, Eye, ExternalLink, KeyRound, Play, Plus, RefreshCw, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AgentOption = {
  id: string;
  name: string;
  category: string;
  provider: string;
  modelName: string;
};

type ApiState = {
  loading: boolean;
  action?: "preview" | "auth" | "create" | "queue" | "process" | "post";
  error?: string;
  message?: string;
};

type ContextPreview = {
  dropCount: number;
  fromDropId: string | null;
  toDropId: string | null;
  context: {
    from: string | null;
    to: string | null;
    maxMessages: number;
    searchedMessages: number;
    explicitWindow: boolean;
  };
  sampleDrops: Array<{
    id: string;
    serialNo: number | null;
    author: string;
    createdAt: string | null;
    preview: string;
  }>;
};

export function ManualBattleRunner({
  agents,
  categories,
}: {
  agents: AgentOption[];
  categories: string[];
}) {
  const [adminKey, setAdminKey] = useState("");
  const [waveId, setWaveId] = useState("");
  const [requestText, setRequestText] = useState("@AgentArena summarize this wave");
  const [contextFrom, setContextFrom] = useState("");
  const [contextTo, setContextTo] = useState("");
  const [maxMessages, setMaxMessages] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Wave Summarization");
  const [battleType, setBattleType] = useState<"official" | "test">("official");
  const categoryAgents = useMemo(
    () => agents.filter((agent) => agent.category === category),
    [agents, category],
  );
  const [agentA, setAgentA] = useState(categoryAgents[0]?.id ?? "");
  const [agentB, setAgentB] = useState(categoryAgents[1]?.id ?? "");
  const [battleId, setBattleId] = useState("");
  const [createPoll, setCreatePoll] = useState(false);
  const [preview, setPreview] = useState<ContextPreview | null>(null);
  const [state, setState] = useState<ApiState>({ loading: false });

  function headers() {
    return {
      "content-type": "application/json",
      ...(adminKey ? { "x-admin-api-key": adminKey } : {}),
    };
  }

  const sameAgentSelected = Boolean(agentA && agentB && agentA === agentB);
  const hasEnoughAgents = categoryAgents.length >= 2;
  const canCreateBattle = Boolean(waveId.trim() && requestText.trim());
  const canQueueRun = Boolean(battleId && agentA && agentB && hasEnoughAgents && !sameAgentSelected);

  async function callApi(path: string, body: unknown, action: ApiState["action"]) {
    setState({ loading: true, action });
    const response = await fetch(path, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error ?? "Request failed.");
    }

    return json;
  }

  function contextPayload() {
    return {
      waveId,
      contextFrom: contextFrom ? new Date(contextFrom).toISOString() : undefined,
      contextTo: contextTo ? new Date(contextTo).toISOString() : undefined,
      maxMessages: maxMessages ? Number(maxMessages) : undefined,
    };
  }

  async function previewContext() {
    try {
      const result = await callApi("/api/admin/6529/context", contextPayload(), "preview");
      setPreview(result.preview);
      setState({
        loading: false,
        message: `Fetched ${result.preview.dropCount} drops from the selected 6529 window.`,
      });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Request failed." });
    }
  }

  async function check6529Auth() {
    try {
      const result = await callApi("/api/admin/6529/auth-check", {}, "auth");
      setState({
        loading: false,
        message: `6529 auth ok for ${result.walletAddress ?? "configured wallet"}.`,
      });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Request failed." });
    }
  }

  async function createBattle() {
    try {
      const result = await callApi("/api/battles", {
        ...contextPayload(),
        requestText,
        category,
        battleType,
        isOfficial: battleType === "official",
      }, "create");
      setBattleId(result.battle.id);
      setState({ loading: false, message: "Battle created and wave drops snapshotted." });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Request failed." });
    }
  }

  async function runSelectedBattle() {
    try {
      const result = await callApi(`/api/battles/${battleId}/run`, {
        agentIds: [agentA, agentB].filter(Boolean),
        mode: "queued",
      }, "queue");
      setState({
        loading: false,
        message: `Queued battle run job ${result.job.id.slice(0, 8)}.`,
      });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Request failed." });
    }
  }

  async function processQueuedJobs() {
    try {
      const result = await callApi("/api/admin/jobs/process", {
        limit: 1,
      }, "process");
      setState({
        loading: false,
        message: result.processed
          ? `Processed ${result.processed} queued job. Open the battle page to review outputs.`
          : "No queued jobs were ready.",
      });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Request failed." });
    }
  }

  async function postTo6529() {
    try {
      await callApi(`/api/battles/${battleId}/post-to-6529`, {
        createPoll,
      }, "post");
      setState({ loading: false, message: "Battle posted to 6529." });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Request failed." });
    }
  }

  function onCategoryChange(nextCategory: string) {
    setCategory(nextCategory);
    const nextAgents = agents.filter((agent) => agent.category === nextCategory);
    setAgentA(nextAgents[0]?.id ?? "");
    setAgentB(nextAgents[1]?.id ?? "");
  }

  return (
    <section className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
      <div className="mb-5 grid gap-3 border-b border-zinc-200 pb-5 dark:border-zinc-800 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Battle setup</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Default context is the last 24 hours of a wave, capped at 500 messages. Add a time window only when the request needs a narrower or longer search.
          </p>
        </div>
        <div className="grid gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-3">
          <StatusStep label="1. Context" active={!battleId} />
          <StatusStep label="2. Agents" active={Boolean(battleId && !state.loading)} />
          <StatusStep label="3. Post" active={Boolean(battleId)} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-normal text-zinc-500 dark:text-zinc-500">Wave context</h3>
          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="admin-key">
              Admin key
            </label>
            <Input
              id="admin-key"
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Optional after admin login"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="wave-id">
                Wave ID
              </label>
              <Input id="wave-id" value={waveId} onChange={(event) => setWaveId(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="category">
                Category
              </label>
              <Select id="category" value={category} onChange={(event) => onCategoryChange(event.target.value)}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="battle-type">
                Battle type
              </label>
              <Select
                id="battle-type"
                value={battleType}
                onChange={(event) => setBattleType(event.target.value as "official" | "test")}
              >
                <option value="official">Official leaderboard</option>
                <option value="test">Test run only</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="request-text">
              Request prompt
            </label>
            <Textarea
              id="request-text"
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="context-from">
                From
              </label>
              <Input
                id="context-from"
                type="datetime-local"
                value={contextFrom}
                onChange={(event) => setContextFrom(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="context-to">
                To
              </label>
              <Input
                id="context-to"
                type="datetime-local"
                value={contextTo}
                onChange={(event) => setContextTo(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="max-messages">
                Max messages
              </label>
              <Input
                id="max-messages"
                type="number"
                min={1}
                max={5000}
                value={maxMessages}
                onChange={(event) => setMaxMessages(event.target.value)}
                placeholder="500"
              />
            </div>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Leave From, To, and Max messages empty for the standard 24-hour context.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-normal text-zinc-500 dark:text-zinc-500">Agents and actions</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="agent-a">
                Agent A
              </label>
              <Select id="agent-a" value={agentA} onChange={(event) => setAgentA(event.target.value)} disabled={!categoryAgents.length}>
                {categoryAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.provider})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="agent-b">
                Agent B
              </label>
              <Select id="agent-b" value={agentB} onChange={(event) => setAgentB(event.target.value)} disabled={!categoryAgents.length}>
                {categoryAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.provider})
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={createPoll}
              onChange={(event) => setCreatePoll(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
            />
            Use native 6529 poll when posting
          </label>
          {!hasEnoughAgents ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              This category needs at least two active agents before a battle can run.
            </p>
          ) : null}
          {sameAgentSelected ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Choose two different agents before queuing a run.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={previewContext} disabled={state.loading || !waveId}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              {state.action === "preview" ? "Previewing" : "Preview Context"}
            </Button>
            <Button type="button" variant="secondary" onClick={check6529Auth} disabled={state.loading}>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {state.action === "auth" ? "Checking" : "Check 6529 Auth"}
            </Button>
            <Button type="button" onClick={createBattle} disabled={state.loading || !canCreateBattle}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {state.action === "create" ? "Creating" : "Create Battle"}
            </Button>
            <Button type="button" variant="secondary" onClick={runSelectedBattle} disabled={state.loading || !canQueueRun}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {state.action === "queue" ? "Queuing" : "Queue Run"}
            </Button>
            <Button type="button" variant="secondary" onClick={processQueuedJobs} disabled={state.loading}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {state.action === "process" ? "Processing" : "Process One Job"}
            </Button>
            <Button type="button" variant="secondary" onClick={postTo6529} disabled={state.loading || !battleId}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {state.action === "post" ? "Posting" : "Post to 6529"}
            </Button>
            {battleId ? (
              <ButtonLink href={`/battles/${battleId}`} variant="quiet">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open Battle
              </ButtonLink>
            ) : null}
          </div>
          {!battleId ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create a battle before queuing agents, posting to 6529, or opening the battle page.
            </p>
          ) : null}
          {state.error ? (
            <p aria-live="polite" className="flex gap-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {state.error}
            </p>
          ) : null}
          {state.message ? (
            <p aria-live="polite" className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm text-emerald-900 dark:text-emerald-200">
              {state.message}
            </p>
          ) : null}
          {preview ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="grid gap-2 text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
                <span>Drops: {preview.dropCount}</span>
                <span>Searched: {preview.context.searchedMessages}</span>
                <span>From: {preview.context.from ? new Date(preview.context.from).toLocaleString() : "n/a"}</span>
                <span>To: {preview.context.to ? new Date(preview.context.to).toLocaleString() : "n/a"}</span>
              </div>
              <div className="mt-3 space-y-2">
                {preview.sampleDrops.length ? preview.sampleDrops.map((drop) => (
                  <div key={drop.id} className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-500">
                      #{drop.serialNo ?? "n/a"} · {drop.author} ·{" "}
                      {drop.createdAt ? new Date(drop.createdAt).toLocaleString() : "unknown time"}
                    </div>
                    <p className="mt-1 line-clamp-2 text-zinc-700 dark:text-zinc-300">
                      {drop.preview || "No text content found in this drop."}
                    </p>
                  </div>
                )) : (
                  <p className="rounded border border-zinc-200 bg-white p-2 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    No sample drops were found in this context window.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StatusStep({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={
        active
          ? "rounded-md border border-teal-200 bg-teal-50 px-3 py-2 font-semibold text-teal-900 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-200"
          : "rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
      }
    >
      {label}
    </div>
  );
}
