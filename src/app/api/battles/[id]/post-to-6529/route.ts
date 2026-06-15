import { z } from "zod";
import { postBattleTo6529, previewBattlePost } from "@/lib/data/battle-actions";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  createPoll: z.boolean().default(false),
  pollClosingHours: z.number().int().min(1).max(24 * 14).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const preview = await previewBattlePost({ battleId: id, appUrl });

    return json({ preview });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJson(request, postSchema);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const battle = await postBattleTo6529({
      battleId: id,
      appUrl,
      createPoll: body.createPoll,
      pollClosingHours: body.pollClosingHours,
    });

    return json({ battle });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
