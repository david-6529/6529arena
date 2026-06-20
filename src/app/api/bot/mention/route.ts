import { z } from "zod";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { checkWaveBriefGenerationConfig, consumeWaveBriefGenerationRateLimit } from "@/lib/briefs/request-gates";
import { createWaveBriefDraft, getWaveBriefByTrigger } from "@/lib/data/wave-briefs";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const relatedWaveSchema = z.object({
  waveId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(80).optional(),
});

const mentionSchema = z.object({
  waveId: z.string().trim().min(1),
  dropId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(1).optional(),
  text: z.string().trim().min(1).max(1000),
  requestText: z.string().trim().min(1).max(1000).optional(),
  relatedWaves: z.array(relatedWaveSchema).max(8).optional(),
  maxMessages: z.number().int().min(1).max(20000).optional(),
  maxOutputTokens: z.number().int().min(400).max(4000).optional(),
  includeAllHistory: z.boolean().optional(),
  contextFrom: z.string().trim().min(1).optional(),
  contextTo: z.string().trim().min(1).optional(),
  provider: z.enum(["openai", "anthropic", "google", "ollama"]).optional(),
  modelName: z.string().trim().min(1).max(120).optional(),
  autoRun: z.boolean().optional(),
  autoPost: z.boolean().optional(),
  createPoll: z.boolean().optional(),
});

function reviewUrl(request: Request, briefId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  return `${appUrl.replace(/\/$/, "")}/operator/briefs#${briefId}`;
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = await parseJson(request, mentionSchema);
    const requestText = body.requestText ?? body.text;
    const existingBrief = body.dropId
      ? await getWaveBriefByTrigger({
          waveId: body.waveId,
          triggerDropId: body.dropId,
        })
      : null;

    if (existingBrief) {
      await logEvent({
        type: "bot.mention_summary_deduped",
        entityType: "wave_brief",
        entityId: existingBrief.id,
        actor: "bot",
        message: "Bot mention reused an existing wave check-in draft for the trigger drop.",
        metadata: {
          waveId: body.waveId,
          triggerDropId: body.dropId,
          idempotencyKey: body.idempotencyKey,
        },
      });

      return json({
        brief: existingBrief,
        deduped: true,
        reviewRequired: true,
        reviewUrl: reviewUrl(request, existingBrief.id),
        publicPostSkipped: Boolean(body.autoPost),
      });
    }

    const configGate = await checkWaveBriefGenerationConfig({
      waveId: body.waveId,
      provider: body.provider,
      modelName: body.modelName,
      actor: "bot",
      actorLabel: "Bot",
    });

    if (!configGate.ok) {
      return configGate.response;
    }

    const rateLimitGate = await consumeWaveBriefGenerationRateLimit({
      request,
      waveId: body.waveId,
      scope: "bot_wave_brief",
      limit: configGate.limit,
      actor: "bot",
      actorLabel: "Bot",
    });

    if (!rateLimitGate.ok) {
      return rateLimitGate.response;
    }

    const brief = await createWaveBriefDraft({
      waveId: body.waveId,
      triggerDropId: body.dropId,
      requestText,
      contextFrom: body.contextFrom,
      contextTo: body.contextTo,
      maxMessages: body.maxMessages,
      ...(body.maxOutputTokens ? { maxOutputTokens: body.maxOutputTokens } : {}),
      includeAllHistory: body.includeAllHistory,
      relatedWaves: body.relatedWaves,
      provider: body.provider,
      modelName: body.modelName,
    });

    await logEvent({
      type: "bot.mention_summary_draft_created",
      entityType: "wave_brief",
      entityId: brief.id,
      actor: "bot",
      message: "Bot mention created a reviewed wave check-in draft instead of public autoposting.",
      metadata: {
        waveId: body.waveId,
        triggerDropId: body.dropId,
        idempotencyKey: body.idempotencyKey,
        relatedWaveCount: body.relatedWaves?.length ?? 0,
        autoRunRequested: body.autoRun ?? null,
        autoPostRequested: body.autoPost ?? null,
        createPollRequested: body.createPoll ?? null,
      },
    });

    return json(
      {
        brief,
        remaining: rateLimitGate.rateLimit.remaining,
        reviewRequired: true,
        reviewUrl: reviewUrl(request, brief.id),
        publicPostSkipped: Boolean(body.autoPost),
      },
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
