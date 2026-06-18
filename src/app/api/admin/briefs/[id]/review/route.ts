import { z } from "zod";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { reviewWaveBrief } from "@/lib/data/wave-briefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "update"]),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(20000).optional(),
  reviewerNotes: z.string().trim().max(2000).optional(),
  reviewedBy: z.string().trim().max(120).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJson(request, reviewSchema);
    const brief = await reviewWaveBrief({
      briefId: id,
      ...body,
    });

    return json({ brief });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
