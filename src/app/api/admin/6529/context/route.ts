import { z } from "zod";
import { previewWaveContext } from "@/lib/data/battle-actions";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const previewSchema = z.object({
  waveId: z.string().min(1),
  maxMessages: z.number().int().min(1).max(5000).optional(),
  contextFrom: z.string().min(1).optional(),
  contextTo: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = await parseJson(request, previewSchema);
    const preview = await previewWaveContext(body);

    await logEvent({
      type: "admin.wave_context_previewed",
      entityType: "wave",
      entityId: body.waveId,
      actor: "admin",
      message: "Admin previewed 6529 wave context.",
      metadata: {
        dropCount: preview.dropCount,
        maxMessages: body.maxMessages,
        contextFrom: body.contextFrom,
        contextTo: body.contextTo,
      },
    });

    return json({ preview });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
