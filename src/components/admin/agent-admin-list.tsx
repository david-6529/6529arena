"use client";

import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, History, Plus, PowerOff } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatUsd } from "@/lib/format";

export type AdminAgentRow = {
  id: string;
  name: string;
  slug: string;
  ownerHandle: string | null;
  ownerWallet: string | null;
  category: string;
  description: string | null;
  provider: string;
  modelName: string;
  systemPrompt: string;
  isPublic: boolean;
  isActive: boolean;
  maxCostUsd: number | null;
  createdAt: string;
  updatedAt: string;
  versions: Array<{
    id: string;
    version: number;
    provider: string;
    modelName: string;
    systemPrompt: string;
    maxCostUsd: number | null;
    description: string | null;
    isActive: boolean;
    createdAt: string;
  }>;
  counts: {
    runs: number;
    battleEntries: number;
  };
};

type ApiState = {
  loading?: string;
  error?: string;
  message?: string;
};

type VersionDraft = {
  provider: string;
  modelName: string;
  maxCostUsd: string;
  description: string;
  systemPrompt: string;
};

function defaultDraft(agent: AdminAgentRow): VersionDraft {
  return {
    provider: agent.provider,
    modelName: agent.modelName,
    maxCostUsd: agent.maxCostUsd == null ? "" : String(agent.maxCostUsd),
    description: agent.description ?? "",
    systemPrompt: agent.systemPrompt,
  };
}

function errorMessage(payload: { error?: string; errorId?: string }) {
  return payload.errorId ? `${payload.error ?? "Request failed."} (${payload.errorId})` : payload.error ?? "Request failed.";
}

export function AgentAdminList({ agents }: { agents: AdminAgentRow[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, VersionDraft>>(() =>
    Object.fromEntries(agents.map((agent) => [agent.id, defaultDraft(agent)])),
  );
  const [state, setState] = useState<ApiState>({});

  function updateDraft(agentId: string, patch: Partial<VersionDraft>) {
    setDrafts((current) => ({
      ...current,
      [agentId]: {
        ...current[agentId],
        ...patch,
      },
    }));
  }

  async function createVersion(agent: AdminAgentRow) {
    const draft = drafts[agent.id] ?? defaultDraft(agent);
    const parsedCost = draft.maxCostUsd ? Number(draft.maxCostUsd) : null;

    if (parsedCost != null && (!Number.isFinite(parsedCost) || parsedCost <= 0)) {
      setState({ error: "Max cost must be a positive number or blank." });
      return;
    }

    setState({ loading: `${agent.id}:version` });

    try {
      const response = await fetch(`/api/admin/agents/${agent.id}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: draft.provider,
          modelName: draft.modelName,
          maxCostUsd: parsedCost,
          description: draft.description || null,
          systemPrompt: draft.systemPrompt,
          activate: true,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(errorMessage(json));
      }

      setState({ message: `Created version ${json.version.version} for ${agent.name}.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Version creation failed." });
    }
  }

  async function deactivate(agent: AdminAgentRow) {
    setState({ loading: `${agent.id}:deactivate` });

    try {
      const response = await fetch(`/api/admin/agents/${agent.id}/deactivate`, { method: "POST" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(errorMessage(json));
      }

      setState({ message: `Deactivated ${agent.name}.` });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Deactivate failed." });
    }
  }

  return (
    <div className="space-y-4">
      {state.error ? (
        <p aria-live="polite" className="rounded-md border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p aria-live="polite" className="flex items-center gap-2 rounded-md border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((agent) => {
          const draft = drafts[agent.id] ?? defaultDraft(agent);
          const versionLoading = state.loading === `${agent.id}:version`;
          const deactivateLoading = state.loading === `${agent.id}:deactivate`;

          return (
            <article key={agent.id} className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-zinc-950 dark:text-zinc-50">{agent.name}</h2>
                    <Badge className={agent.isActive ? "border-emerald-800 bg-emerald-950/40 text-emerald-200" : "border-zinc-700 bg-zinc-950 text-zinc-300"}>
                      {agent.isActive ? "active" : "inactive"}
                    </Badge>
                    {agent.isPublic ? <Badge>public</Badge> : null}
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {agent.category} · {agent.slug}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{agent.provider}</Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => deactivate(agent)}
                    disabled={!agent.isActive || versionLoading || deactivateLoading}
                  >
                    <PowerOff className="h-4 w-4" aria-hidden="true" />
                    {deactivateLoading ? "Deactivating" : "Deactivate"}
                  </Button>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <Info label="Model" value={agent.modelName} />
                <Info label="Max cost" value={formatUsd(agent.maxCostUsd)} />
                <Info label="Runs" value={String(agent.counts.runs)} />
                <Info label="Battle entries" value={String(agent.counts.battleEntries)} />
              </dl>

              <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <History className="h-4 w-4" aria-hidden="true" />
                  Version History
                </summary>
                <div className="mt-3 space-y-3">
                  {agent.versions.map((version) => (
                    <div key={version.id} className="rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-zinc-950 dark:text-zinc-50">
                          v{version.version} · {version.provider}/{version.modelName}
                        </p>
                        <Badge className={version.isActive ? "border-emerald-800 bg-emerald-950/40 text-emerald-200" : "border-zinc-700 bg-zinc-950 text-zinc-300"}>
                          {version.isActive ? "active" : "inactive"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                        {formatUsd(version.maxCostUsd)} · {formatDate(version.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </details>

              <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  Create Version
                </summary>
                <div className="mt-3 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      <span className="mb-1 block">Provider</span>
                      <Input value={draft.provider} onChange={(event) => updateDraft(agent.id, { provider: event.target.value })} />
                    </label>
                    <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      <span className="mb-1 block">Model</span>
                      <Input value={draft.modelName} onChange={(event) => updateDraft(agent.id, { modelName: event.target.value })} />
                    </label>
                    <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      <span className="mb-1 block">Max cost</span>
                      <Input value={draft.maxCostUsd} onChange={(event) => updateDraft(agent.id, { maxCostUsd: event.target.value })} />
                    </label>
                  </div>
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="mb-1 block">Description</span>
                    <Input value={draft.description} onChange={(event) => updateDraft(agent.id, { description: event.target.value })} />
                  </label>
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="mb-1 block">System prompt</span>
                    <Textarea
                      className="min-h-36"
                      value={draft.systemPrompt}
                      onChange={(event) => updateDraft(agent.id, { systemPrompt: event.target.value })}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => createVersion(agent)} disabled={versionLoading || deactivateLoading}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {versionLoading ? "Creating" : "Create Version"}
                    </Button>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500 dark:text-zinc-500">{label}</dt>
      <dd className="font-semibold text-zinc-950 dark:text-zinc-50">{value}</dd>
    </div>
  );
}
