import { ListChecks } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { BattleAdminOps } from "@/components/admin/battle-admin-ops";
import { PageFrame } from "@/components/site/shell";
import { formatDate } from "@/lib/format";
import { listBattles } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function AdminBattlesPage() {
  const battles = await listBattles(50);

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
            <ListChecks className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Admin
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Battles</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin">Run Battle</ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <BattleAdminOps />

      <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs uppercase text-zinc-500 dark:text-zinc-500">
              <tr>
                {["Created", "Battle ID", "Wave", "Prompt", "Status", "Job", "Type", "Entries", "Votes", ""].map((header) => (
                  <th key={header} className="px-4 py-3 font-bold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {battles.map((battle) => (
                <tr key={battle.id}>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatDate(battle.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">{battle.id}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{battle.waveId}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-zinc-50">{battle.requestText}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{battle.status}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{battle.jobs[0]?.status ?? "n/a"}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{battle.isOfficial ? "official" : "test"}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{battle.entries.length}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{battle.votes.length}</td>
                  <td className="px-4 py-3 text-right">
                    <ButtonLink href={`/battles/${battle.id}`} variant="quiet" size="sm">
                      Open
                    </ButtonLink>
                  </td>
                </tr>
              ))}
              {!battles.length ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-zinc-600 dark:text-zinc-400">
                    No battles created yet.
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
