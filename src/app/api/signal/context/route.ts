import { z } from "zod";
import { buildWaveContextPreview, fetchWaveContext } from "@/lib/6529/wave-context";
import { handleRouteError, json, parseJson } from "@/lib/api";
import { estimateWaveBriefDraftCost } from "@/lib/briefs/runBrief";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const previewSchema = z.object({
  waveId: z.string().min(1),
  requestText: z.string().trim().min(1).max(1000).optional(),
  maxMessages: z.number().int().min(1).max(20000).optional(),
  maxOutputTokens: z.number().int().min(400).max(4000).optional(),
  includeAllHistory: z.boolean().optional(),
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
  provider: z.enum(["openai", "anthropic", "google", "ollama"]).optional(),
  modelName: z.string().trim().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, previewSchema);
    const waveContext = await fetchWaveContext(body);
    const preview = buildWaveContextPreview({
      waveId: body.waveId,
      waveContext,
    });
    const briefEstimate = body.requestText
      ? estimateWaveBriefDraftCost({
          waveId: body.waveId,
          requestText: body.requestText,
          drops: waveContext.drops,
          context: waveContext.context,
          provider: body.provider,
          modelName: body.modelName,
          ...(body.maxOutputTokens ? { maxOutputTokens: body.maxOutputTokens } : {}),
        })
      : null;

    await logEvent({
      type: "signal.wave_context_previewed",
      entityType: "wave",
      entityId: body.waveId,
      actor: "signal",
      message: "Signal user previewed 6529 wave context.",
      metadata: {
        dropCount: preview.dropCount,
        maxMessages: body.maxMessages,
        includeAllHistory: body.includeAllHistory,
        contextFrom: body.contextFrom,
        contextTo: body.contextTo,
        relatedWaveCount: body.relatedWaves?.length ?? 0,
        provider: briefEstimate?.provider,
        modelName: briefEstimate?.modelName,
        promptTokens: briefEstimate?.promptTokens,
        estimatedCostUsd: briefEstimate?.estimatedCostUsd,
      },
    });

    return json({ preview: briefEstimate ? { ...preview, briefEstimate } : preview });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
