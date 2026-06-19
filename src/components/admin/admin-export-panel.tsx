import { Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

const exports = [
  {
    label: "Leaderboard CSV",
    href: "/api/admin/export?type=leaderboard",
    evaluationOnly: false,
  },
  {
    label: "Wave Check-ins CSV",
    href: "/api/admin/export?type=wave-check-ins",
    evaluationOnly: false,
  },
  {
    label: "Wave Tasks CSV",
    href: "/api/admin/export?type=wave-tasks",
    evaluationOnly: false,
  },
  {
    label: "Battles CSV",
    href: "/api/admin/export?type=battles",
    evaluationOnly: true,
  },
  {
    label: "Votes CSV",
    href: "/api/admin/export?type=votes",
    evaluationOnly: true,
  },
  {
    label: "Agent Runs CSV",
    href: "/api/admin/export?type=agent-runs",
    evaluationOnly: true,
  },
];

export function AdminExportPanel({ simpleLaunch = false }: { simpleLaunch?: boolean }) {
  const visibleExports = simpleLaunch ? exports.filter((item) => !item.evaluationOnly) : exports;

  return (
    <section className="mt-6 rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
        <h2 className="font-bold text-zinc-950 dark:text-zinc-50">CSV Exports</h2>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        {simpleLaunch
          ? "Download check-in, task, and leaderboard metadata. Battle, vote, and run exports return when evaluation tools are enabled."
          : "Download operational data for check-in review, task follow-up, leaderboard analysis, vote reconciliation, and run-cost review."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {visibleExports.map((item) => (
          <ButtonLink key={item.href} href={item.href} variant="secondary">
            <Download className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </ButtonLink>
        ))}
      </div>
    </section>
  );
}
