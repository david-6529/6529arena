import { Bot, CheckCircle2, ClipboardCheck, FileText, Inbox, ListChecks, ListTodo, Swords, TestTube2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { AdminExportPanel } from "@/components/admin/admin-export-panel";
import { AdminMaintenancePanel } from "@/components/admin/admin-maintenance-panel";
import { ManualBattleRunner } from "@/components/admin/manual-battle-runner";
import { PageFrame } from "@/components/site/shell";
import { arenaCategories } from "@/lib/agents/internal-agents";
import { isSimpleLaunchMode, SIMPLE_LAUNCH_CATEGORY, visibleArenaCategories } from "@/lib/features";
import { getAgents, listBattles } from "@/lib/data/queries";
import { getSystemStatus, type SystemStatus } from "@/lib/system/health";
import { listRecentEvents } from "@/lib/observability/events";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const simpleLaunch = isSimpleLaunchMode();
  const [agents, battles, systemStatus, events] = await Promise.all([
    getAgents(),
    listBattles(6),
    getSystemStatus(),
    listRecentEvents(12),
  ]);
  const visibleCategories = visibleArenaCategories(arenaCategories);
  const visibleAgents = simpleLaunch
    ? agents.filter((agent) => agent.category === SIMPLE_LAUNCH_CATEGORY)
    : agents;

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
            <Swords className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Admin
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Manual Battle Runner</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            Create a wave-summary battle from a 6529 wave ID, run two internal agents, and prepare a post back into the wave.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/agents" variant="secondary">
            <Bot className="h-4 w-4" aria-hidden="true" />
            Agents
          </ButtonLink>
          <ButtonLink href="/admin/battles" variant="secondary">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            Battles
          </ButtonLink>
          <ButtonLink href="/admin/briefs" variant="secondary">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Briefs
          </ButtonLink>
          <ButtonLink href="/admin/tasks" variant="secondary">
            <ListTodo className="h-4 w-4" aria-hidden="true" />
            Tasks
          </ButtonLink>
          {!simpleLaunch ? (
            <>
              <ButtonLink href="/admin/submissions" variant="secondary">
                <Inbox className="h-4 w-4" aria-hidden="true" />
                Submissions
              </ButtonLink>
              <ButtonLink href="/admin/self-tests" variant="secondary">
                <TestTube2 className="h-4 w-4" aria-hidden="true" />
                Self-Tests
              </ButtonLink>
            </>
          ) : null}
          <ButtonLink href="/admin/readiness" variant="secondary">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Readiness
          </ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <SystemStatusPanel status={systemStatus} />

      <ManualBattleRunner
        agents={visibleAgents}
        categories={visibleCategories}
      />

      <AdminMaintenancePanel />

      <AdminExportPanel />

      <section className="mt-6 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Recent Battles</h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {battles.length ? (
            battles.map((battle) => (
              <div key={battle.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-semibold text-zinc-950 dark:text-zinc-50">{battle.requestText}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Wave {battle.waveId} · {battle.status} · {battle.isOfficial ? "official" : "test"} ·{" "}
                    {battle.entries.length} entries
                    {battle.jobs[0] ? ` · job ${battle.jobs[0].status}` : ""}
                  </p>
                </div>
                <ButtonLink href={`/battles/${battle.id}`} variant="quiet" size="sm">
                  Open
                </ButtonLink>
              </div>
            ))
          ) : (
            <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">No battles created yet.</div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Recent Events</h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {events.length ? (
            events.map((event) => (
              <div key={event.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <p className="font-semibold text-zinc-950 dark:text-zinc-50">
                    {event.type}
                    <span className="ml-2 text-xs font-medium text-zinc-500 dark:text-zinc-500">
                      {event.severity}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {event.message ?? "No message"} {event.battleId ? `· battle ${event.battleId.slice(0, 8)}` : ""}
                  </p>
                </div>
                <span className="text-sm text-zinc-500 dark:text-zinc-500">{formatDate(event.createdAt)}</span>
              </div>
            ))
          ) : (
            <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">No events recorded yet.</div>
          )}
        </div>
      </section>
    </PageFrame>
  );
}

function SystemStatusPanel({ status }: { status: SystemStatus }) {
  const checks = [
    {
      label: "Database",
      ok: status.database.configured && status.database.reachable,
      detail: status.database.reachable
        ? "reachable"
        : status.database.configured
          ? "configured, not reachable"
          : "missing DATABASE_URL",
    },
    {
      label: "Admin API key",
      ok: status.security.adminKeyConfigured,
      detail: status.security.adminKeyConfigured ? "enabled" : "not set",
    },
    {
      label: "6529 posting",
      ok: status.api6529.readyToPost && !status.api6529.mockMode,
      detail: status.api6529.mockMode
        ? "mock mode enabled"
        : status.api6529.readyToPost
          ? "wallet ready"
          : "missing wallet or private key",
    },
    {
      label: "AI provider",
      ok: status.aiProviders.some((provider) => provider.configured),
      detail: status.aiProviders
        .filter((provider) => provider.configured)
        .map((provider) => provider.provider)
        .join(", ") || "no provider keys",
    },
    {
      label: "Wallet signatures",
      ok: true,
      detail: status.security.walletConnectConfigured
        ? "injected wallet + WalletConnect configured"
        : "injected wallet linking available",
    },
  ];

  return (
    <section className="mb-6 rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Production Readiness</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            6529 API base: {status.api6529.baseUrl}
          </p>
        </div>
        <Badge
          className={
            status.readyForProduction
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          }
        >
          {status.readyForProduction ? "Ready" : "Needs config"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {checks.map((check) => {
          const Icon = check.ok ? CheckCircle2 : XCircle;

          return (
            <div
              key={check.label}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={check.ok ? "h-4 w-4 text-emerald-600 dark:text-emerald-300" : "h-4 w-4 text-amber-600 dark:text-amber-300"}
                  aria-hidden="true"
                />
                <span className="font-semibold text-zinc-950 dark:text-zinc-50">{check.label}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{check.detail}</p>
            </div>
          );
        })}
      </div>
      {status.database.error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          Database error: {status.database.error}
        </p>
      ) : null}
    </section>
  );
}
