import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { BattleAdminOps } from "@/components/admin/battle-admin-ops";
import { Badge } from "@/components/ui/badge";
import { PageFrame } from "@/components/site/shell";
import { VoteButtons } from "@/components/site/vote-buttons";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from "@/lib/admin-auth";
import { formatDate, formatLatency, formatUsd } from "@/lib/format";
import { getBattleDetail } from "@/lib/data/queries";
import type { WaveDrop } from "@/lib/6529/types";

export const dynamic = "force-dynamic";

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = await getBattleDetail(id);

  if (!battle) {
    notFound();
  }

  const isClosed = battle.status === "closed";
  const drops = extractDrops(battle.snapshots[0]?.dropsJson);
  const showAdminControls = await canShowAdminControls();
  const voteHelper = isClosed
    ? "Voting is closed. Agent names and the winner are visible."
    : battle.entries.length < 2
      ? "Voting opens after both options are generated."
      : "Vote for the more useful option. Agent names stay hidden until the battle closes.";

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-200">
              {battle.status}
            </Badge>
            <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {battle.isOfficial ? "Official" : "Test run"}
            </Badge>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Battle {battle.id.slice(0, 8)}</h1>
          <p className="mt-2 max-w-3xl text-zinc-700 dark:text-zinc-300">{battle.requestText}</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Compare Option A and Option B on accuracy, clarity, citations, and usefulness. Cost and latency are recorded after generation.
          </p>
        </div>
        <VoteButtons battleId={battle.id} disabled={isClosed || battle.entries.length < 2} helper={voteHelper} />
      </div>

      {showAdminControls ? <BattleAdminOps initialBattleId={battle.id} /> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {battle.entries.map((entry) => {
          const votes = battle.votes.filter((vote) => vote.selectedEntryId === entry.id || vote.selectedLabel === entry.label);
          const winner = battle.winnerEntryId === entry.id;

          return (
            <article key={entry.id} className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-950 dark:text-zinc-50">Option {entry.label}</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {isClosed
                      ? `${entry.agent.name} · v${entry.agentVersion?.version ?? "legacy"} · ${entry.agentVersion?.provider ?? entry.agent.provider}/${entry.agentVersion?.modelName ?? entry.agent.modelName}`
                      : "Agent hidden until voting closes"}
                  </p>
                </div>
                {winner ? <Badge className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">Winner</Badge> : null}
              </div>
              <div className="space-y-4 p-5">
                <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-200">{entry.output}</div>
                <dl className="grid gap-3 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800 sm:grid-cols-3">
                  <Meta label="Votes" value={String(votes.length)} />
                  <Meta label="Cost" value={formatUsd(entry.costUsd)} />
                  <Meta label="Latency" value={formatLatency(entry.latencyMs)} />
                </dl>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-6 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Source Drops Used</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Wave {battle.waveId} · snapshot {formatDate(battle.snapshots[0]?.createdAt)}
          </p>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {drops.slice(0, 12).map((drop) => (
            <div key={drop.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
                <span>{drop.id}</span>
                <span>serial {drop.serial_no ?? "n/a"}</span>
                <span>{drop.author?.handle ?? drop.author?.display ?? "unknown"}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{drop.content}</p>
            </div>
          ))}
          {!drops.length ? <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">No snapshot drops found.</div> : null}
        </div>
      </section>
    </PageFrame>
  );
}

async function canShowAdminControls() {
  if (!process.env.ADMIN_API_KEY) {
    return true;
  }

  const cookieStore = await cookies();

  return isValidAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500 dark:text-zinc-500">{label}</dt>
      <dd className="font-semibold text-zinc-950 dark:text-zinc-50">{value}</dd>
    </div>
  );
}

function extractDrops(payload: unknown): WaveDrop[] {
  if (payload && typeof payload === "object" && "drops" in payload) {
    const drops = (payload as { drops?: unknown }).drops;

    return Array.isArray(drops) ? (drops as WaveDrop[]) : [];
  }

  return [];
}
