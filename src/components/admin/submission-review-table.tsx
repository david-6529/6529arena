"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, KeyRound, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SubmissionReviewRow = {
  id: string;
  status: string;
  name: string;
  slug: string | null;
  ownerHandle: string | null;
  ownerWallet: string | null;
  category: string;
  description: string | null;
  provider: string;
  modelName: string;
  systemPrompt: string;
  maxCostUsd: number | null;
  endpointUrl: string | null;
  submitterEmail: string | null;
  reviewerNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  approvedAgent: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type ApiState = {
  loadingId?: string;
  error?: string;
  message?: string;
};

function statusBadgeClass(status: string) {
  if (status === "approved") {
    return "border-emerald-700 bg-emerald-950/40 text-emerald-200";
  }

  if (status === "rejected") {
    return "border-red-800 bg-red-950/40 text-red-200";
  }

  return "border-amber-800 bg-amber-950/40 text-amber-200";
}

function reviewBlocker(row: SubmissionReviewRow) {
  if (row.status === "approved" && row.approvedAgent) {
    return "Already approved";
  }

  if (row.endpointUrl) {
    return "Endpoint sandbox not implemented";
  }

  if (row.maxCostUsd == null) {
    return "Missing max cost";
  }

  return undefined;
}

export function SubmissionReviewTable({ submissions }: { submissions: SubmissionReviewRow[] }) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [state, setState] = useState<ApiState>({});

  async function reviewSubmission(row: SubmissionReviewRow, action: "approve" | "reject") {
    setState({ loadingId: `${row.id}:${action}` });

    try {
      const response = await fetch(`/api/admin/agent-submissions/${row.id}/review`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(adminKey ? { "x-admin-api-key": adminKey } : {}),
        },
        body: JSON.stringify({
          action,
          reviewedBy: reviewedBy || undefined,
          reviewerNotes: notesById[row.id] || undefined,
          activate: true,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Review failed.");
      }

      setState({
        message:
          action === "approve"
            ? `Approved ${row.name}.`
            : `Rejected ${row.name}.`,
      });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Review failed." });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 flex items-center gap-2">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Admin key
          </span>
          <Input
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="Optional after admin login"
          />
        </label>
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">Reviewer</span>
          <Input
            value={reviewedBy}
            onChange={(event) => setReviewedBy(event.target.value)}
            placeholder="admin handle or wallet"
          />
        </label>
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="rounded-md border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">
          {state.message}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-[1320px] w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500">
              <tr>
                {[
                  "Created",
                  "Status",
                  "Agent",
                  "Owner",
                  "Category",
                  "Model",
                  "Max cost",
                  "Review",
                  "Actions",
                ].map((header) => (
                  <th key={header} className="px-4 py-3 font-bold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {submissions.map((submission) => {
                const blocker = reviewBlocker(submission);
                const approveLoading = state.loadingId === `${submission.id}:approve`;
                const rejectLoading = state.loadingId === `${submission.id}:reject`;
                const canReject = !submission.approvedAgent;

                return (
                  <tr key={submission.id} className="align-top">
                    <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">{formatDate(submission.createdAt)}</td>
                    <td className="px-4 py-4">
                      <Badge className={statusBadgeClass(submission.status)}>{submission.status}</Badge>
                      {submission.reviewedAt ? (
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                          {formatDate(submission.reviewedAt)}
                          {submission.reviewedBy ? ` by ${submission.reviewedBy}` : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-sm px-4 py-4">
                      <p className="font-semibold text-zinc-950 dark:text-zinc-50">{submission.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">{submission.id}</p>
                      {submission.approvedAgent ? (
                        <Link
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                          href={`/agents/${submission.approvedAgent.slug}`}
                        >
                          Live agent
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      ) : null}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                          Prompt
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-100 p-3 text-xs leading-5 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                          {submission.systemPrompt}
                        </pre>
                      </details>
                    </td>
                    <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                      {submission.ownerHandle ?? submission.ownerWallet ?? "n/a"}
                      {submission.submitterEmail ? (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{submission.submitterEmail}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">{submission.category}</td>
                    <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                      <p>{submission.provider}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">{submission.modelName}</p>
                      {submission.endpointUrl ? (
                        <Badge className="mt-2 border-red-800 bg-red-950/40 text-red-200">endpoint</Badge>
                      ) : (
                        <Badge className="mt-2 border-zinc-700 bg-zinc-950 text-zinc-300">prompt config</Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">{formatUsd(submission.maxCostUsd)}</td>
                    <td className="w-72 px-4 py-4">
                      <Textarea
                        className="min-h-20"
                        value={notesById[submission.id] ?? submission.reviewerNotes ?? ""}
                        onChange={(event) =>
                          setNotesById((current) => ({
                            ...current,
                            [submission.id]: event.target.value,
                          }))
                        }
                        placeholder="Reviewer notes"
                      />
                      {blocker ? (
                        <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">{blocker}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={Boolean(blocker) || approveLoading || rejectLoading}
                          onClick={() => reviewSubmission(submission, "approve")}
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          {approveLoading ? "Approving" : "Approve"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          className={cn(!canReject && "opacity-50")}
                          disabled={!canReject || approveLoading || rejectLoading}
                          onClick={() => reviewSubmission(submission, "reject")}
                        >
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          {rejectLoading ? "Rejecting" : "Reject"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!submissions.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-600 dark:text-zinc-400">
                    No submissions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
