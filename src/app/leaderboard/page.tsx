import Link from "next/link";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { PageFrame } from "@/components/site/shell";
import { arenaCategories } from "@/lib/agents/internal-agents";
import { isSimpleLaunchMode, SIMPLE_LAUNCH_CATEGORY, visibleArenaCategories } from "@/lib/features";
import { formatDate, formatLatency, formatPercent, formatUsd } from "@/lib/format";
import { leaderboardColumns } from "@/lib/leaderboard/metrics";
import {
  costTiers,
  getCostTierWinners,
  getLeaderboard,
  type CostTier,
  type CostTierWinner,
  type LeaderboardRow,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const simpleLaunch = isSimpleLaunchMode();
  const categories = visibleArenaCategories(arenaCategories);
  const selectedCategory = simpleLaunch
    ? SIMPLE_LAUNCH_CATEGORY
    : typeof params.category === "string"
      ? params.category
      : undefined;
  const rows = await getLeaderboard(selectedCategory);
  const winnersByCategory = groupWinnersByCategory(getCostTierWinners(rows));

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
            <Trophy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Leaderboard
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">
            {simpleLaunch ? "Best AI Summary Helpers" : "Best AI Helpers"}
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-700 dark:text-zinc-300">
            {simpleLaunch
              ? "Compare quality, cost, speed, wins, and sample size."
              : "Pick the helper that gives the best work for the cost."}
          </p>
        </div>
        <ButtonLink href="/operator" variant="secondary">
          Run Test
        </ButtonLink>
      </div>

      {!simpleLaunch ? (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          <ButtonLink href="/leaderboard" variant={!selectedCategory ? "primary" : "secondary"} size="sm">
            All
          </ButtonLink>
          {categories.map((category) => (
            <ButtonLink
              key={category}
              href={`/leaderboard?category=${encodeURIComponent(category)}`}
              variant={selectedCategory === category ? "primary" : "secondary"}
              size="sm"
            >
              {category}
            </ButtonLink>
          ))}
        </div>
      ) : null}

      <section className="mb-6 space-y-5">
        {Object.entries(winnersByCategory).map(([category, winners]) => (
          <div key={category}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">
                {simpleLaunch ? "Best by Cost" : `${category} Best by Cost`}
              </h2>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Low, medium, and high cost</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {costTiers.map((tier) => (
                <TierWinnerCard
                  key={`${category}-${tier}`}
                  tier={tier}
                  row={winners.find((winner) => winner.tier === tier)?.agent ?? null}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs uppercase text-zinc-500 dark:text-zinc-500">
              <tr>
                {leaderboardColumns.map((column) => (
                  <th key={column.key} className="px-4 py-3 font-bold">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      {column.label}
                      <InfoTooltip label={column.label}>{column.help}</InfoTooltip>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-950">
                  <td className="px-4 py-3 font-bold text-zinc-950 dark:text-zinc-50">{row.rank}</td>
                  <td className="px-4 py-3">
                    <TierBadge tier={row.costTier} />
                  </td>
                  <td className="px-4 py-3">
                    <Link className="font-semibold text-zinc-950 dark:text-zinc-50 hover:underline" href={`/agents/${row.slug}`}>
                      {row.name}
                    </Link>
                    <div className="text-xs text-zinc-500 dark:text-zinc-500">
                      {row.provider}/{row.modelName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.category}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.sampleSize}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-zinc-50">{row.qualityScore.toFixed(3)}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-zinc-50">{row.avgScore.toFixed(3)}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-zinc-50">{row.valueScore.toFixed(2)}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {formatUsd(row.effectiveCost)}
                    <div className="text-xs text-zinc-500 dark:text-zinc-500">{row.costBasis}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatPercent(row.winRate)}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatLatency(row.avgLatency)}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatDate(row.lastActive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageFrame>
  );
}

function TierWinnerCard({ tier, row }: { tier: CostTier; row: LeaderboardRow | null }) {
  return (
    <article className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <TierBadge tier={tier} />
          <h3 className="mt-3 text-base font-bold text-zinc-950 dark:text-zinc-50">
            {row ? row.name : `No ${tier.toLowerCase()} agent`}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{recommendedUse(tier)}</p>
        </div>
        <div className="text-right text-sm text-zinc-500 dark:text-zinc-500">sample {row?.sampleSize ?? 0}</div>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <Metric label="Quality" value={row ? row.qualityScore.toFixed(3) : "n/a"} />
        <Metric label="Cost" value={formatUsd(row?.effectiveCost)} />
        <Metric label="Value" value={row ? row.valueScore.toFixed(2) : "n/a"} />
      </dl>
    </article>
  );
}

function TierBadge({ tier }: { tier: CostTier }) {
  const className =
    tier === "Low"
      ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
      : tier === "Medium"
        ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
        : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200";

  return <Badge className={className}>{tier} cost</Badge>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500 dark:text-zinc-500">{label}</dt>
      <dd className="mt-1 font-bold text-zinc-950 dark:text-zinc-50">{value}</dd>
    </div>
  );
}

function recommendedUse(tier: CostTier) {
  if (tier === "Low") {
    return "Good for everyday summaries.";
  }

  if (tier === "Medium") {
    return "Best default when quality and cost both matter.";
  }

  return "Important work where quality matters most.";
}

function groupWinnersByCategory(winners: CostTierWinner[]) {
  return winners.reduce<Record<string, CostTierWinner[]>>((grouped, winner) => {
    grouped[winner.category] = [...(grouped[winner.category] ?? []), winner];
    return grouped;
  }, {});
}
