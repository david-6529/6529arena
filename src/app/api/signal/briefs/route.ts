import { z } from "zod";
import { handleRouteError, json, parseJson } from "@/lib/api";
import { checkWaveBriefGenerationConfig, consumeWaveBriefGenerationRateLimit } from "@/lib/briefs/request-gates";
import { createWaveBriefDraft } from "@/lib/data/wave-briefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBriefSchema = z.object({
  waveId: z.string().trim().min(1),
  triggerDropId: z.string().trim().min(1).optional(),
  requestText: z.string().trim().min(1).max(1000).optional(),
  contextFrom: z.string().trim().min(1).optional(),
  contextTo: z.string().trim().min(1).optional(),
  maxMessages: z.number().int().min(1).max(20000).optional(),
  maxOutputTokens: z.number().int().min(400).max(4000).optional(),
  includeAllHistory: z.boolean().optional(),
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
    const body = await parseJson(request, createBriefSchema);
    const configGate = await checkWaveBriefGenerationConfig({
      waveId: body.waveId,
      provider: body.provider,
      modelName: body.modelName,
      actor: "signal",
      actorLabel: "Signal user",
    });

    if (!configGate.ok) {
      return configGate.response;
    }

    const rateLimitGate = await consumeWaveBriefGenerationRateLimit({
      request,
      waveId: body.waveId,
      scope: "signal_wave_brief",
      limit: configGate.limit,
      actor: "signal",
      actorLabel: "Signal user",
    });

    if (!rateLimitGate.ok) {
      return rateLimitGate.response;
    }

    const brief = await createWaveBriefDraft(body);

    return json(
      { brief, remaining: rateLimitGate.rateLimit.remaining },
      {
        status: 201,
        headers: {
          "x-ratelimit-remaining": String(rateLimitGate.rateLimit.remaining),
          "x-ratelimit-reset": rateLimitGate.rateLimit.resetAt.toISOString(),
        },
      },
    );
  } catch (error) {
    return handleRouteError(error, request);
  }
}
