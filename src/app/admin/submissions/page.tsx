import { Inbox } from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { SubmissionReviewTable, type SubmissionReviewRow } from "@/components/admin/submission-review-table";
import { PageFrame } from "@/components/site/shell";
import { getAgentSubmissionFilterOptions, listAgentSubmissions } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSubmissionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = getParam(params, "status") ?? "pending";
  const category = getParam(params, "category") ?? "all";
  const provider = getParam(params, "provider") ?? "all";
  const [submissions, filterOptions] = await Promise.all([
    listAgentSubmissions({
      limit: 100,
      status,
      category,
      provider,
    }),
    getAgentSubmissionFilterOptions(),
  ]);
  const rows: SubmissionReviewRow[] = submissions.map((submission) => ({
    id: submission.id,
    status: submission.status,
    name: submission.name,
    slug: submission.slug,
    ownerHandle: submission.ownerHandle,
    ownerWallet: submission.ownerWallet,
    category: submission.category,
    description: submission.description,
    provider: submission.provider,
    modelName: submission.modelName,
    systemPrompt: submission.systemPrompt,
    maxCostUsd: submission.maxCostUsd,
    endpointUrl: submission.endpointUrl,
    submitterEmail: submission.submitterEmail,
    reviewerNotes: submission.reviewerNotes,
    reviewedBy: submission.reviewedBy,
    reviewedAt: submission.reviewedAt?.toISOString() ?? null,
    createdAt: submission.createdAt.toISOString(),
    approvedAgent: submission.approvedAgent,
  }));

  return (
    <PageFrame>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <Inbox className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Admin
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Agent Submissions</h1>
          <p className="mt-2 max-w-2xl text-zinc-700 dark:text-zinc-300">
            Public submissions stay in review until manually promoted into active agents.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/submit" variant="secondary">
            Submission Form
          </ButtonLink>
          <AdminLogoutButton />
        </div>
      </div>

      <form className="mb-4 grid gap-3 rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end">
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">Status</span>
          <select
            name="status"
            defaultValue={status}
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="all">All statuses</option>
            {filterOptions.statuses.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">Category</span>
          <select
            name="category"
            defaultValue={category}
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="all">All categories</option>
            {filterOptions.categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">Provider</span>
          <select
            name="provider"
            defaultValue={provider}
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="all">All providers</option>
            {filterOptions.providers.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary">
          Apply Filters
        </Button>
        <ButtonLink href="/admin/submissions" variant="quiet">
          Reset
        </ButtonLink>
      </form>

      <SubmissionReviewTable submissions={rows} />
    </PageFrame>
  );
}
