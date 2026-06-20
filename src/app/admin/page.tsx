import { Bot, CheckCircle2, ClipboardCheck, FileText, Inbox, ListChecks, ListTodo, TestTube2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { AdminExportPanel } from "@/components/admin/admin-export-panel";
import { AdminMaintenancePanel } from "@/components/admin/admin-maintenance-panel";
import { ManualBattleRunner } from "@/components/admin/manual-battle-runner";
import { PageFrame } from "@/components/site/shell";
import { validateWaveBriefContentSources } from "@/lib/briefs/source-validation";
import { getWaveBriefCostStats, getWaveBriefReviewStats, listWaveBriefs } from "@/lib/data/wave-briefs";
import {
  getWaveTaskOutcomeStats,
  getWaveTaskOwnerStats,
  getWaveTaskWaveStats,
  getWaveTaskWorkflowStats,
  listWaveTasks,
} from "@/lib/data/wave-tasks";
import type { WaveTaskOutcomeScore, WaveTaskOwnerStats, WaveTaskWaveStats, WaveTaskWorkflowStats } from "@/lib/data/wave-tasks";
import { arenaCategories } from "@/lib/agents/internal-agents";
import { isSimpleLaunchMode, visibleArenaCategories } from "@/lib/features";
import { getAgents, listBattles } from "@/lib/data/queries";
import { getSystemStatus, type SystemStatus } from "@/lib/system/health";
import { listRecentEvents } from "@/lib/observability/events";
import { formatDate, formatLatency, formatUsd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const simpleLaunch = isSimpleLaunchMode();
  const [summaries, tasks, reviewStats, costStats, outcomeStats, ownerStats, waveStats, workflowStats, systemStatus, events] = await Promise.all([
    listWaveBriefs(6),
    listWaveTasks(6),
    getWaveBriefReviewStats(),
    getWaveBriefCostStats(),
    getWaveTaskOutcomeStats(),
    getWaveTaskOwnerStats(),
    getWaveTaskWaveStats(),
    getWaveTaskWorkflowStats(),
    getSystemStatus(),
    listRecentEvents(12),
  ]);
  const [agents, battles] = simpleLaunch
    ? [[], []]
    : await Promise.all([
        getAgents(),
        listBattles(6),
      ]);
  const visibleCategories = simpleLaunch ? [] : visibleArenaCategories(arenaCategories);
  const visibleAgents = simpleLaunch ? [] : agents;
  const openSummaryCount = summaries.filter((summary) => summary.status === "draft").length;
  const checkedSummaryCount = summaries.filter((summary) => summary.status === "approved" || summary.status === "posted").length;
  const openTaskCount = tasks.filter((task) => ["suggested", "confirmed", "in_progress"].includes(task.status)).length;

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
            <ClipboardCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Console
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">The Doomed Signal Console</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">
            Create wave check-ins, post only when useful, then track follow-ups. You only need wave-level permission when posting back to 6529.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/operator/briefs">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Create Check-in
          </ButtonLink>
          <ButtonLink href="/operator/tasks" variant="secondary">
            <ListTodo className="h-4 w-4" aria-hidden="true" />
            Tasks
          </ButtonLink>
          <ButtonLink href="/operator/agents" variant="secondary">
            <Bot className="h-4 w-4" aria-hidden="true" />
            Agents
          </ButtonLink>
          {!simpleLaunch ? (
            <>
              <ButtonLink href="/operator/battles" variant="secondary">
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                Battles
              </ButtonLink>
              <ButtonLink href="/operator/submissions" variant="secondary">
                <Inbox className="h-4 w-4" aria-hidden="true" />
                Submissions
              </ButtonLink>
              <ButtonLink href="/operator/self-tests" variant="secondary">
                <TestTube2 className="h-4 w-4" aria-hidden="true" />
                Self-Tests
              </ButtonLink>
            </>
          ) : null}
          <ButtonLink href="/operator/readiness" variant="secondary">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Readiness
          </ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <SystemStatusPanel status={systemStatus} />

      <section className="mb-6 grid gap-4 lg:grid-cols-4">
        <LaunchStep
          label="1"
          title="Create Check-in"
          detail="Pick a wave and generate a catch-up note from real 6529 context."
          href="/operator/briefs"
          action="Open Signal"
        />
        <LaunchStep
          label="2"
          title="Check And Score"
          detail={`There ${openSummaryCount === 1 ? "is" : "are"} ${openSummaryCount} draft ${openSummaryCount === 1 ? "check-in" : "check-ins"} waiting in the latest list.`}
          href="/operator/briefs"
          action="Check Drafts"
        />
        <LaunchStep
          label="3"
          title="Track Follow-Ups"
          detail={`${openTaskCount} open ${openTaskCount === 1 ? "task" : "tasks"} from check-ins or manual review.`}
          href="/operator/tasks"
          action="Open Tasks"
        />
        <LaunchStep
          label="4"
          title="Check Readiness"
          detail="Confirm production URL, access key auth, cron auth, model provider, rate limits, and 6529 posting config."
          href="/operator/readiness"
          action="Run Checks"
        />
      </section>

      <section className="mb-6 rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Check-in Quality Rollups</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Score check-ins for usefulness before they teach the routing layer anything.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <OutcomeMetric label="Total" value={String(reviewStats.totalCount)} />
            <OutcomeMetric label="Reviewed" value={String(reviewStats.reviewedCount)} />
            <OutcomeMetric label="Scored" value={String(reviewStats.scoredCount)} />
            <OutcomeMetric label="Unscored" value={String(reviewStats.unscoredReviewedCount)} />
            <OutcomeMetric label="Posted" value={String(reviewStats.postedCount)} />
            <OutcomeMetric
              label="Avg score"
              value={reviewStats.averageHumanScore == null ? "n/a" : `${reviewStats.averageHumanScore.toFixed(1)}/5`}
            />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Check-in Cost Rollups</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Track spend, token volume, and latency before expanding check-in usage.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <OutcomeMetric label="Costed" value={String(costStats.costedCount)} />
            <OutcomeMetric label="Total cost" value={formatUsd(costStats.totalCostUsd)} />
            <OutcomeMetric label="Avg cost" value={formatUsd(costStats.averageCostUsd)} />
            <OutcomeMetric label="Max cost" value={formatUsd(costStats.maxCostUsd)} />
            <OutcomeMetric label="Avg latency" value={formatLatency(costStats.averageLatencyMs)} />
            <OutcomeMetric label="Tokens" value={formatTokenCount(costStats.totalPromptTokens + costStats.totalCompletionTokens)} />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Outcome Rollups</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Completed follow-ups should be scored so the system can learn which work actually helped.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-7">
            <OutcomeMetric label="Completed" value={String(outcomeStats.completedCount)} />
            <OutcomeMetric label="With proof" value={formatCountPair(outcomeStats.evidenceCount, outcomeStats.completedCount)} />
            <OutcomeMetric label="Scored" value={String(outcomeStats.scoredCount)} />
            <OutcomeMetric label="Unscored" value={String(outcomeStats.unscoredCompletedCount)} />
            <OutcomeMetric
              label="Avg score"
              value={outcomeStats.averageOutcomeScore == null ? "n/a" : `${outcomeStats.averageOutcomeScore.toFixed(1)}/5`}
            />
            <OutcomeMetric label="Strong 4-5" value={String(outcomeStats.strongOutcomeCount)} />
            <OutcomeMetric label="Review 1-2" value={String(outcomeStats.weakOutcomeCount)} />
          </div>
        </div>
        <OutcomeScoreDistribution
          distribution={outcomeStats.outcomeScoreDistribution}
          total={outcomeStats.scoredCount}
        />
      </section>

      <section className="mb-6 rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Wave Rollups</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Find waves with unresolved follow-ups, repeated open work, and weak completed outcomes.
          </p>
        </div>
        <WaveRollups stats={waveStats} />
      </section>

      <section className="mb-6 rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Workflow Rollups</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Compare workflow load and outcome quality across grants, governance, product, curation, and other work.
          </p>
        </div>
        <WorkflowRollups stats={workflowStats} />
      </section>

      <section className="mb-6 rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Owner Rollups</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Watch owner load, completion proof, and weak outcomes before assigning more work.
          </p>
        </div>
        <OwnerRollups stats={ownerStats} />
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col justify-between gap-2 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Recent Check-ins</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Check citations, quality, cost, and posting status before anything goes back to a wave.
              </p>
            </div>
            <Badge>{checkedSummaryCount} checked or posted</Badge>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {summaries.length ? (
              summaries.map((summary) => {
                const sourceGate = validateWaveBriefContentSources(summary.content, summary.dropsJson);

                return (
                  <div key={summary.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-zinc-950 dark:text-zinc-50">{summary.title}</p>
                        <StatusBadge status={summary.status} />
                        <SourceGateBadge missingCount={sourceGate.missingDropIds.length} />
                      </div>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        Wave {summary.waveId} · {formatDate(summary.createdAt)} · {formatUsd(summary.costUsd)} ·{" "}
                        human score {summary.humanScore ? `${summary.humanScore}/5` : "not set"}
                      </p>
                    </div>
                    <ButtonLink href="/operator/briefs" variant="quiet" size="sm">
                      Check
                    </ButtonLink>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">
                No wave check-ins generated yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Follow-Up Queue</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Suggested work stays human-checked before it becomes official.
            </p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {tasks.length ? (
              tasks.map((task) => (
                <div key={task.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-semibold text-zinc-950 dark:text-zinc-50">{task.title}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Wave {task.waveId} · {task.status} · owner {task.assignedTo ?? task.suggestedOwner ?? "unassigned"}
                      {task.seenCount > 1 ? ` · seen ${task.seenCount}x` : ""}
                      {task.lastSeenAt ? ` · last seen ${formatDate(task.lastSeenAt)}` : ""}
                    </p>
                  </div>
                  <ButtonLink href="/operator/tasks" variant="quiet" size="sm">
                    Open
                  </ButtonLink>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">
                No follow-ups created yet.
              </div>
            )}
          </div>
        </div>
      </section>

      {!simpleLaunch ? (
        <section className="mb-6">
          <div className="mb-3">
            <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Evaluation Battle Runner</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
              Feature-gated infrastructure for comparing two agents on the same wave. This is not the default launch workflow.
            </p>
          </div>
          <ManualBattleRunner
            agents={visibleAgents}
            categories={visibleCategories}
          />
        </section>
      ) : null}

      <AdminMaintenancePanel />

      <AdminExportPanel simpleLaunch={simpleLaunch} />

      {!simpleLaunch ? (
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
      ) : null}

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
                    {event.message ?? "No message"}
                    {event.entityId ? ` · ${event.entityType ?? "entity"} ${event.entityId.slice(0, 8)}` : ""}
                    {event.battleId ? ` · battle ${event.battleId.slice(0, 8)}` : ""}
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

function LaunchStep({
  label,
  title,
  detail,
  href,
  action,
}: {
  label: string;
  title: string;
  detail: string;
  href: string;
  action: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Badge>{label}</Badge>
      <h2 className="mt-3 font-bold text-zinc-950 dark:text-zinc-50">{title}</h2>
      <p className="mt-2 min-h-16 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{detail}</p>
      <ButtonLink href={href} variant="secondary" size="sm" className="mt-4">
        {action}
      </ButtonLink>
    </div>
  );
}

function OutcomeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-zinc-500 dark:text-zinc-500">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-zinc-950 dark:text-zinc-50">{value}</dd>
    </div>
  );
}

function OutcomeScoreDistribution({
  distribution,
  total,
}: {
  distribution: Record<WaveTaskOutcomeScore, number>;
  total: number;
}) {
  const scores: WaveTaskOutcomeScore[] = [5, 4, 3, 2, 1];

  return (
    <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
      <div className="grid gap-3 sm:grid-cols-5">
        {scores.map((score) => {
          const count = distribution[score];
          const width = total > 0 ? `${Math.max((count / total) * 100, count > 0 ? 8 : 0)}%` : "0%";

          return (
            <div key={score}>
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-500">
                <span>{score}/5</span>
                <span>{count}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-950">
                <div
                  className="h-2 rounded-full bg-emerald-500 dark:bg-emerald-400"
                  style={{ width }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatCountPair(count: number, total: number) {
  return total > 0 ? `${count}/${total}` : "0";
}

function formatTokenCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function WaveRollups({ stats }: { stats: WaveTaskWaveStats[] }) {
  if (!stats.length) {
    return <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">No wave activity yet.</div>;
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {stats.map((wave) => (
        <div key={wave.waveId} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1.6fr] lg:items-center">
          <div>
            <p className="font-semibold text-zinc-950 dark:text-zinc-50">Wave {wave.waveId}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {wave.totalTrackedCount} tracked · {wave.openCount} open · {wave.completedCount} completed
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-6">
            <OutcomeMetric label="Repeated open" value={String(wave.repeatedOpenCount)} />
            <OutcomeMetric label="With proof" value={formatCountPair(wave.evidenceCount, wave.completedCount)} />
            <OutcomeMetric label="Scored" value={String(wave.scoredCount)} />
            <OutcomeMetric label="Unscored" value={String(wave.unscoredCompletedCount)} />
            <OutcomeMetric
              label="Avg score"
              value={wave.averageOutcomeScore == null ? "n/a" : `${wave.averageOutcomeScore.toFixed(1)}/5`}
            />
            <OutcomeMetric label="Review 1-2" value={String(wave.weakOutcomeCount)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkflowRollups({ stats }: { stats: WaveTaskWorkflowStats[] }) {
  if (!stats.length) {
    return <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">No workflow activity yet.</div>;
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {stats.map((workflow) => (
        <div key={workflow.workflowLabel} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1.6fr] lg:items-center">
          <div>
            <p className="font-semibold text-zinc-950 dark:text-zinc-50">{workflow.workflowLabel}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {workflow.totalTrackedCount} tracked · {workflow.openCount} open · {workflow.completedCount} completed
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-6">
            <OutcomeMetric label="Repeated open" value={String(workflow.repeatedOpenCount)} />
            <OutcomeMetric label="With proof" value={formatCountPair(workflow.evidenceCount, workflow.completedCount)} />
            <OutcomeMetric label="Scored" value={String(workflow.scoredCount)} />
            <OutcomeMetric label="Unscored" value={String(workflow.unscoredCompletedCount)} />
            <OutcomeMetric
              label="Avg score"
              value={workflow.averageOutcomeScore == null ? "n/a" : `${workflow.averageOutcomeScore.toFixed(1)}/5`}
            />
            <OutcomeMetric label="Review 1-2" value={String(workflow.weakOutcomeCount)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OwnerRollups({ stats }: { stats: WaveTaskOwnerStats[] }) {
  if (!stats.length) {
    return <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">No owner activity yet.</div>;
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {stats.map((owner) => (
        <div key={owner.owner} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <p className="font-semibold text-zinc-950 dark:text-zinc-50">{owner.owner}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {owner.totalTrackedCount} tracked · {owner.openCount} open · {owner.completedCount} completed
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <OutcomeMetric label="With proof" value={formatCountPair(owner.evidenceCount, owner.completedCount)} />
            <OutcomeMetric label="Scored" value={String(owner.scoredCount)} />
            <OutcomeMetric label="Unscored" value={String(owner.unscoredCompletedCount)} />
            <OutcomeMetric
              label="Avg score"
              value={owner.averageOutcomeScore == null ? "n/a" : `${owner.averageOutcomeScore.toFixed(1)}/5`}
            />
            <OutcomeMetric label="Review 1-2" value={String(owner.weakOutcomeCount)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "posted"
      ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
      : status === "approved"
        ? "border-teal-800 bg-teal-950/30 text-teal-200"
        : status === "rejected"
          ? "border-red-800 bg-red-950/30 text-red-200"
          : "border-amber-800 bg-amber-950/30 text-amber-200";

  const label = status === "approved" ? "checked" : status === "rejected" ? "discarded" : status;

  return <Badge className={className}>{label}</Badge>;
}

function SourceGateBadge({ missingCount }: { missingCount: number }) {
  return (
    <Badge
      className={
        missingCount
          ? "border-red-800 bg-red-950/30 text-red-200"
          : "border-emerald-800 bg-emerald-950/30 text-emerald-200"
      }
    >
      {missingCount ? `${missingCount} source gate blocked` : "source gate clear"}
    </Badge>
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
      label: "Production URL",
      ok: status.app.productionUrlConfigured,
      detail: status.app.productionUrlConfigured
        ? status.app.publicUrl ?? "configured"
        : status.app.publicUrl ?? "missing NEXT_PUBLIC_APP_URL",
    },
    {
      label: "Access key",
      ok: status.security.adminKeyConfigured,
      detail: status.security.adminKeyConfigured ? "enabled" : "not set",
    },
    {
      label: "Cron auth",
      ok: status.security.cronSecretConfigured,
      detail: status.security.cronSecretConfigured ? "enabled" : "missing CRON_SECRET",
    },
    {
      label: "Rate-limit salt",
      ok: status.security.rateLimitSaltConfigured,
      detail: status.security.rateLimitSaltConfigured ? "enabled" : "missing RATE_LIMIT_SALT",
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
      label: "Check-in AI",
      ok: status.waveBriefProvider.configured,
      detail: status.waveBriefProvider.configured
        ? status.waveBriefProvider.provider
        : `missing ${status.waveBriefProvider.keyName}`,
    },
    {
      label: "Check-in cap",
      ok: status.costCaps.waveBriefEstimatedCostUsd !== null,
      detail:
        status.costCaps.waveBriefEstimatedCostUsd === null
          ? "not set"
          : `$${status.costCaps.waveBriefEstimatedCostUsd.toFixed(2)} max`,
    },
    {
      label: "Check-in rate",
      ok: status.rateLimits.waveBriefPerHour !== null,
      detail:
        status.rateLimits.waveBriefPerHour === null
          ? "missing or invalid"
          : `${status.rateLimits.waveBriefPerHour}/hr`,
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
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              <p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-400">{check.detail}</p>
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
