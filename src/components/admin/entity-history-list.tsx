import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export type EntityHistoryEventRow = {
  id: string;
  type: string;
  severity: string;
  message: string | null;
  actor: string | null;
  createdAt: string;
};

function severityClass(severity: string) {
  if (severity === "error") {
    return "border-red-800 bg-red-950/40 text-red-200";
  }

  if (severity === "warn") {
    return "border-amber-800 bg-amber-950/40 text-amber-200";
  }

  if (severity === "debug") {
    return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }

  return "border-cyan-800 bg-cyan-950/40 text-cyan-200";
}

export function EntityHistoryList({
  events,
  emptyText,
}: {
  events: EntityHistoryEventRow[];
  emptyText: string;
}) {
  return (
    <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-zinc-50">
        <History className="h-4 w-4" aria-hidden="true" />
        Change History
      </h3>
      {events.length ? (
        <ol className="mt-3 space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
          {events.map((event) => (
            <li key={event.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-zinc-950 dark:text-zinc-50">{event.type}</span>
                <Badge className={severityClass(event.severity)}>{event.severity}</Badge>
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{event.message ?? "No message recorded."}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                {formatDate(event.createdAt)}
                {event.actor ? ` by ${event.actor}` : ""}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{emptyText}</p>
      )}
    </div>
  );
}
