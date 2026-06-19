import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Clock3, CircleDollarSign, Lock, ShieldCheck, Trophy, UserRoundCheck, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageFrame } from "@/components/site/shell";
import { formatDate, formatLatency, formatUsd } from "@/lib/format";
import { getAgentProfile } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function AgentProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = await getAgentProfile(slug);

  if (!agent) {
    notFound();
  }

  const entries = "battleEntries" in agent ? agent.battleEntries : [];
  const runs = "runs" in agent ? agent.runs : [];
  const wins = entries.filter((entry) => entry.battle?.winnerEntryId === entry.id).length;
  const avgCost = average(runs.map((run) => run.costUsd).filter((value): value is number => typeof value === "number"));
  const avgLatency = average(runs.map((run) => run.latencyMs).filter((value): value is number => typeof value === "number"));
  const ownerLinked = "ownerIdentityId" in agent && Boolean(agent.ownerIdentityId);

  return (
    <PageFrame>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <Badge className="border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200">
            <Bot className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {agent.category}
          </Badge>
          <h1 className="mt-4 text-3xl font-bold text-zinc-950 dark:text-zinc-50">{agent.name}</h1>
          <p className="mt-3 text-zinc-700 dark:text-zinc-300">{agent.description ?? "Internal summary helper."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <TrustBadge icon={ShieldCheck} label="Prompt helper" tone="green" />
            <TrustBadge icon={Lock} label="No outside endpoint" tone="zinc" />
            <TrustBadge
              icon={ownerLinked ? UserRoundCheck : UserRoundX}
              label={ownerLinked ? "Owner wallet linked" : "Owner not checked"}
              tone={ownerLinked ? "green" : "amber"}
            />
          </div>
          <dl className="mt-6 grid gap-4 text-sm">
            <Info label="Owner" value={agent.ownerHandle ?? agent.ownerWallet ?? "6529-AgentArena"} />
            <Info label="Provider" value={agent.provider} />
            <Info label="Model" value={agent.modelName} />
            <Info label="Max cost" value={formatUsd(agent.maxCostUsd)} />
          </dl>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Stat icon={Trophy} label="Wins" value={`${wins}/${entries.length}`} />
          <Stat icon={CircleDollarSign} label="Avg cost" value={formatUsd(avgCost)} />
          <Stat icon={Clock3} label="Avg latency" value={formatLatency(avgLatency)} />
        </section>
      </div>

      <section className="mt-6 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
          <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Recent Tests</h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {entries.length ? (
            entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/battles/${entry.battleId}`}
                className="grid gap-2 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-950 sm:grid-cols-[1fr_auto]"
              >
                <span>
                  <span className="font-semibold text-zinc-950 dark:text-zinc-50">Option {entry.label}</span>
                  <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">{entry.battle?.requestText}</span>
                </span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{formatDate(entry.createdAt)}</span>
              </Link>
            ))
          ) : (
            <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">No tests recorded yet.</div>
          )}
        </div>
      </section>
    </PageFrame>
  );
}

function TrustBadge({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  tone: "green" | "amber" | "zinc";
}) {
  const className =
    tone === "green"
      ? "border-emerald-800 bg-emerald-950/40 text-emerald-200"
      : tone === "amber"
        ? "border-amber-800 bg-amber-950/40 text-amber-200"
        : "border-zinc-700 bg-zinc-950 text-zinc-300";

  return (
    <Badge className={className}>
      <Icon className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <dt className="text-zinc-500 dark:text-zinc-500">{label}</dt>
      <dd className="font-semibold text-zinc-950 dark:text-zinc-50">{value}</dd>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
      <Icon className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
      <p className="mt-4 text-2xl font-bold text-zinc-950 dark:text-zinc-50">{value}</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
    </div>
  );
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
