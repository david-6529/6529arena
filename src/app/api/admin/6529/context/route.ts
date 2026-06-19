import { z } from "zod";
import { previewWaveContext } from "@/lib/6529/wave-context";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const previewSchema = z.object({
  waveId: z.string().min(1),
  maxMessages: z.number().int().min(1).max(5000).optional(),
  contextFrom: z.string().min(1).optional(),
  contextTo: z.string().min(1).optional(),
  relatedWaves: z
    .array(
      z.object({
        waveId: z.string().trim().min(1),
        label: z.string().trim().min(1).max(80).optional(),
      }),
    )
    .max(8)
    .optional(),
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
      actor: "operator",
      message: "Operator previewed 6529 wave context.",
      metadata: {
        dropCount: preview.dropCount,
        maxMessages: body.maxMessages,
        contextFrom: body.contextFrom,
        contextTo: body.contextTo,
        relatedWaveCount: body.relatedWaves?.length ?? 0,
      },
    });

    return json({ preview });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
