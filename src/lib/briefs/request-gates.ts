import { getRequestFingerprint, json } from "@/lib/api";
import { getWaveBriefEstimatedCostCapUsd, getWaveBriefProviderConfig } from "@/lib/briefs/runBrief";
import { logEvent } from "@/lib/observability/events";
import { consumeRateLimit, type RateLimitResult } from "@/lib/rate-limit";

export type WaveBriefGenerationConfigGate =
  | {
      ok: true;
      limit: number;
    }
  | {
      ok: false;
      response: Response;
    };

export type WaveBriefRateLimitGate =
  | {
      ok: true;
      rateLimit: RateLimitResult;
    }
  | {
      ok: false;
      response: Response;
      rateLimit: RateLimitResult;
    };

export function waveBriefLimit() {
  const raw = process.env.WAVE_BRIEF_RATE_LIMIT_PER_HOUR;
  const configured = Number(raw ?? 10);

  return Number.isInteger(configured) && configured > 0 ? configured : null;
}

export async function checkWaveBriefGenerationConfig(params: {
  waveId: string;
  provider?: string;
  modelName?: string;
  actor: string;
  actorLabel: string;
}): Promise<WaveBriefGenerationConfigGate> {
  const limit = waveBriefLimit();
  const costCap = getWaveBriefEstimatedCostCapUsd();
  const providerConfig = getWaveBriefProviderConfig({
    provider: params.provider,
    modelName: params.modelName,
  });

  if (limit === null) {
    await logEvent({
      type: "wave_brief.rate_limit_config_invalid",
      severity: "error",
      entityType: "wave",
      entityId: params.waveId,
      actor: params.actor,
      message: `${params.actorLabel} wave check-in generation blocked by invalid rate-limit configuration.`,
      metadata: {
        waveId: params.waveId,
        envName: "WAVE_BRIEF_RATE_LIMIT_PER_HOUR",
      },
    });

    return {
      ok: false,
      response: json(
        { error: "Wave check-in generation is disabled because WAVE_BRIEF_RATE_LIMIT_PER_HOUR must be a positive integer." },
        { status: 503 },
      ),
    };
  }

  if (costCap === null) {
    await logEvent({
      type: "wave_brief.cost_cap_config_invalid",
      severity: "error",
      entityType: "wave",
      entityId: params.waveId,
      actor: params.actor,
      message: `${params.actorLabel} wave check-in generation blocked by invalid cost-cap configuration.`,
      metadata: {
        waveId: params.waveId,
        envName: "MAX_WAVE_BRIEF_ESTIMATED_COST_USD",
      },
    });

    return {
      ok: false,
      response: json(
        { error: "Wave check-in generation is disabled because MAX_WAVE_BRIEF_ESTIMATED_COST_USD must be a positive number." },
        { status: 503 },
      ),
    };
  }

  if (!providerConfig.configured) {
    await logEvent({
      type: "wave_brief.provider_config_missing",
      severity: "error",
      entityType: "wave",
      entityId: params.waveId,
      actor: params.actor,
      message: `${params.actorLabel} wave check-in generation blocked by missing provider key.`,
      metadata: {
        waveId: params.waveId,
        provider: providerConfig.provider,
        modelName: providerConfig.modelName,
        keyName: providerConfig.keyName,
      },
    });

    return {
      ok: false,
      response: json(
        { error: `Wave check-in generation is disabled because ${providerConfig.keyName} is not configured.` },
        { status: 503 },
      ),
    };
  }

  return {
    ok: true,
    limit,
  };
}

export async function consumeWaveBriefGenerationRateLimit(params: {
  request: Request;
  waveId: string;
  limit: number;
  scope: string;
  actor: string;
  actorLabel: string;
}): Promise<WaveBriefRateLimitGate> {
  const fingerprint = getRequestFingerprint(params.request);
  const rateLimit = await consumeRateLimit({
    scope: params.scope,
    identifier: fingerprint,
    limit: params.limit,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    await logEvent({
      type: "wave_brief.rate_limit_rejected",
      severity: "warn",
      entityType: "wave",
      entityId: params.waveId,
      actor: `${params.actor}:${fingerprint}`,
      message: `${params.actorLabel} wave check-in generation rejected by rate limit.`,
      metadata: {
        waveId: params.waveId,
        resetAt: rateLimit.resetAt.toISOString(),
      },
    });

    return {
      ok: false,
      rateLimit,
      response: json(
        { error: "Wave check-in generation rate limit exceeded.", resetAt: rateLimit.resetAt.toISOString() },
        {
          status: 429,
          headers: {
            "x-ratelimit-remaining": String(rateLimit.remaining),
            "x-ratelimit-reset": rateLimit.resetAt.toISOString(),
          },
        },
      ),
    };
  }

  return {
    ok: true,
    rateLimit,
  };
}
