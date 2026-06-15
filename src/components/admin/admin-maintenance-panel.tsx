"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

type MaintenanceResult = {
  staleJobsRecovered: number;
  rateLimitBucketsDeleted: number;
  identityChallengesDeleted: number;
  oldJobsDeleted: number;
  oldEventsDeleted: number;
};

type ApiState = {
  loading: boolean;
  error?: string;
  result?: MaintenanceResult;
};

export function AdminMaintenancePanel() {
  const [state, setState] = useState<ApiState>({ loading: false });

  async function runMaintenance() {
    setState({ loading: true });

    try {
      const response = await fetch("/api/admin/maintenance", { method: "POST" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.errorId ? `${payload.error} (${payload.errorId})` : payload.error ?? "Maintenance failed.");
      }

      setState({ loading: false, result: payload.maintenance });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Maintenance failed.",
      });
    }
  }

  const resultRows = state.result
    ? [
        ["Stale jobs recovered", state.result.staleJobsRecovered],
        ["Expired rate-limit buckets", state.result.rateLimitBucketsDeleted],
        ["Identity challenges", state.result.identityChallengesDeleted],
        ["Old jobs deleted", state.result.oldJobsDeleted],
        ["Old events deleted", state.result.oldEventsDeleted],
      ]
    : [];

  return (
    <section className="mt-6 rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
            <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Operational Maintenance</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Recover stale job locks and prune expired rate limits, old jobs, and old events without processing queued model work.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={runMaintenance} disabled={state.loading}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {state.loading ? "Running" : "Run Maintenance"}
        </Button>
      </div>

      {state.error ? (
        <p aria-live="polite" className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      ) : null}

      {state.result ? (
        <div aria-live="polite" className="mt-4 grid gap-3 sm:grid-cols-5">
          {resultRows.map(([label, value]) => (
            <div key={label} className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-500">{label}</p>
              <p className="mt-1 text-lg font-bold text-zinc-950 dark:text-zinc-50">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
