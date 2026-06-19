import { z } from "zod";
import { getRequestFingerprint, handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { getWaveBriefEstimatedCostCapUsd, getWaveBriefProviderConfig } from "@/lib/briefs/runBrief";
import { createWaveBriefDraft, listWaveBriefs } from "@/lib/data/wave-briefs";
import { logEvent } from "@/lib/observability/events";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBriefSchema = z.object({
  waveId: z.string().trim().min(1),
  triggerDropId: z.string().trim().min(1).optional(),
  requestText: z.string().trim().min(1).max(1000).optional(),
  contextFrom: z.string().trim().min(1).optional(),
  contextTo: z.string().trim().min(1).optional(),
  maxMessages: z.number().int().min(1).max(5000).optional(),
  provider: z.enum(["openai", "anthropic", "google"]).optional(),
  modelName: z.string().trim().min(1).max(120).optional(),
});

function waveBriefLimit() {
  const raw = process.env.WAVE_BRIEF_RATE_LIMIT_PER_HOUR;
  const configured = Number(raw ?? 10);

  return Number.isInteger(configured) && configured > 0 ? configured : null;
}

export async function GET(request: Request) {
  try {
    requireAdmin(request);

    return json({ briefs: await listWaveBriefs() });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = await parseJson(request, createBriefSchema);
    const limit = waveBriefLimit();
    const costCap = getWaveBriefEstimatedCostCapUsd();
    const providerConfig = getWaveBriefProviderConfig({
      provider: body.provider,
      modelName: body.modelName,
    });

    if (limit === null) {
      await logEvent({
        type: "wave_brief.rate_limit_config_invalid",
        severity: "error",
        entityType: "wave",
        entityId: body.waveId,
        actor: "operator",
        message: "Operator wave summary generation blocked by invalid rate-limit configuration.",
        metadata: {
          waveId: body.waveId,
          envName: "WAVE_BRIEF_RATE_LIMIT_PER_HOUR",
        },
      });

      return json(
        { error: "Wave summary generation is disabled because WAVE_BRIEF_RATE_LIMIT_PER_HOUR must be a positive integer." },
        { status: 503 },
      );
    }

    if (costCap === null) {
      await logEvent({
        type: "wave_brief.cost_cap_config_invalid",
        severity: "error",
        entityType: "wave",
        entityId: body.waveId,
        actor: "operator",
        message: "Operator wave summary generation blocked by invalid cost-cap configuration.",
        metadata: {
          waveId: body.waveId,
          envName: "MAX_WAVE_BRIEF_ESTIMATED_COST_USD",
        },
      });

      return json(
        { error: "Wave summary generation is disabled because MAX_WAVE_BRIEF_ESTIMATED_COST_USD must be a positive number." },
        { status: 503 },
      );
    }

    if (!providerConfig.configured) {
      await logEvent({
        type: "wave_brief.provider_config_missing",
        severity: "error",
        entityType: "wave",
        entityId: body.waveId,
        actor: "operator",
        message: "Operator wave summary generation blocked by missing provider key.",
        metadata: {
          waveId: body.waveId,
          provider: providerConfig.provider,
          modelName: providerConfig.modelName,
          keyName: providerConfig.keyName,
        },
      });

      return json(
        { error: `Wave summary generation is disabled because ${providerConfig.keyName} is not configured.` },
        { status: 503 },
      );
    }

    const fingerprint = getRequestFingerprint(request);
    const rateLimit = await consumeRateLimit({
      scope: "admin_wave_brief",
      identifier: fingerprint,
      limit,
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      await logEvent({
        type: "wave_brief.rate_limit_rejected",
        severity: "warn",
        entityType: "wave",
        entityId: body.waveId,
        actor: `operator:${fingerprint}`,
        message: "Operator wave summary generation rejected by rate limit.",
        metadata: {
          waveId: body.waveId,
          resetAt: rateLimit.resetAt.toISOString(),
        },
      });

      return json(
        { error: "Wave summary generation rate limit exceeded.", resetAt: rateLimit.resetAt.toISOString() },
        {
          status: 429,
          headers: {
            "x-ratelimit-remaining": String(rateLimit.remaining),
            "x-ratelimit-reset": rateLimit.resetAt.toISOString(),
          },
        },
      );
    }

    const brief = await createWaveBriefDraft(body);

    return json(
      { brief, remaining: rateLimit.remaining },
      {
        status: 201,
        headers: {
          "x-ratelimit-remaining": String(rateLimit.remaining),
          "x-ratelimit-reset": rateLimit.resetAt.toISOString(),
        },
      },
    );
  } catch (error) {
    return handleRouteError(error, request);
  }
}
