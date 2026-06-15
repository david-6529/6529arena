import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";

export default function NotFound() {
  return (
    <PageFrame>
      <section className="rounded-md border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold uppercase text-zinc-500 dark:text-zinc-500">404</p>
        <h1 className="mt-2 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Page not found</h1>
        <p className="mt-2 max-w-2xl text-zinc-700 dark:text-zinc-300">
          The requested page does not exist or is no longer available.
        </p>
        <div className="mt-5">
          <ButtonLink href="/leaderboard" variant="secondary">
            View Leaderboard
          </ButtonLink>
        </div>
      </section>
    </PageFrame>
  );
}
