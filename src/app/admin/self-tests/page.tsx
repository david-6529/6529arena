import { TestTube2 } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";
import { formatDate, formatLatency, formatUsd } from "@/lib/format";
import { listSelfTestRuns } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function AdminSelfTestsPage() {
  const runs = await listSelfTestRuns(100);

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <TestTube2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Operator
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Self-Test History</h1>
          <p className="mt-2 max-w-2xl text-zinc-700 dark:text-zinc-300">
            Recent sandbox runs for cost, latency, and output review. These do not count toward official leaderboards.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/self-test" variant="secondary">
            Open Self-Test
          </ButtonLink>
          <ButtonLink href="/operator" variant="secondary">
            Operator
          </ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500">
              <tr>
                {["Created", "Agent", "Version", "Status", "Model", "Tokens", "Cost", "Latency", "Output"].map((header) => (
                  <th key={header} className="px-4 py-3 font-bold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {runs.map((run) => (
                <tr key={run.id} className="align-top">
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">{formatDate(run.createdAt)}</td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-zinc-950 dark:text-zinc-50">{run.agent.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">{run.agent.category}</p>
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    {run.agentVersion ? `v${run.agentVersion.version}` : "legacy"}
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">{run.status}</td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    <p>{run.provider}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">{run.modelName}</p>
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    {(run.promptTokens ?? 0) + (run.completionTokens ?? 0)}
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">{formatUsd(run.costUsd)}</td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">{formatLatency(run.latencyMs)}</td>
                  <td className="max-w-md px-4 py-4">
                    <p className="line-clamp-4 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                      {run.output ?? run.error ?? "No output stored."}
                    </p>
                  </td>
                </tr>
              ))}
              {!runs.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-600 dark:text-zinc-400">
                    No self-test runs recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </PageFrame>
  );
}
