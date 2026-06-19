import { z } from "zod";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { createWaveTaskComment } from "@/lib/data/wave-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createTaskCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  author: z.string().trim().max(120).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJson(request, createTaskCommentSchema);
    const comment = await createWaveTaskComment({
      taskId: id,
      ...body,
    });

    return json({ comment }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
