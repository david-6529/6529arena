import { z } from "zod";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { updateWaveTask, waveTaskStatuses } from "@/lib/data/wave-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewTaskSchema = z.object({
  status: z.enum(waveTaskStatuses).optional(),
  title: z.string().trim().min(1).max(240).optional(),
  workflowLabel: z.string().trim().max(80).nullable().optional(),
  suggestedOwner: z.string().trim().max(120).nullable().optional(),
  assignedTo: z.string().trim().max(120).nullable().optional(),
  claimedBy: z.string().trim().max(120).nullable().optional(),
  reviewerNotes: z.string().trim().max(2000).nullable().optional(),
  reviewedBy: z.string().trim().max(120).optional(),
  outcomeDropId: z.string().trim().max(120).optional(),
  outcomeUrl: z.string().trim().max(500).optional(),
  outcomeSummary: z.string().trim().max(1000).optional(),
  outcomeScore: z.number().int().min(1).max(5).nullable().optional(),
  outcomeScoreNotes: z.string().trim().max(1000).nullable().optional(),
  outcomeReviewedBy: z.string().trim().max(120).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJson(request, reviewTaskSchema);
    const task = await updateWaveTask({
      taskId: id,
      ...body,
    });

    return json({ task });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
