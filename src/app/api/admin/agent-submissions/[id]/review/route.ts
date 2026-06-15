import { z } from "zod";
import { approveAgentSubmission, rejectAgentSubmission } from "@/lib/data/agent-submissions";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewerNotes: z.string().max(2000).optional(),
  reviewedBy: z.string().max(120).optional(),
  activate: z.boolean().default(true),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJson(request, reviewSchema);

    if (body.action === "approve") {
      const result = await approveAgentSubmission({
        submissionId: id,
        reviewerNotes: body.reviewerNotes,
        reviewedBy: body.reviewedBy,
        activate: body.activate,
      });

      return json(result);
    }

    const submission = await rejectAgentSubmission({
      submissionId: id,
      reviewerNotes: body.reviewerNotes,
      reviewedBy: body.reviewedBy,
    });

    return json({ submission });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
