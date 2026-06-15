import { z } from "zod";
import { arenaCategories } from "@/lib/agents/internal-agents";
import { getRequestFingerprint, handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { getPrisma } from "@/lib/db/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providerSchema = z.enum(["openai", "anthropic", "google"]);

const submissionSchema = z.object({
  name: z.string().min(2).max(80),
  ownerHandle: z.string().max(80).optional(),
  ownerWallet: z.string().max(120).optional(),
  category: z.string().min(2).max(80).refine((category) => arenaCategories.includes(category), {
    message: "Unsupported agent category.",
  }),
  description: z.string().max(2000).optional(),
  provider: providerSchema,
  modelName: z.string().min(2).max(120),
  systemPrompt: z.string().min(20).max(12_000),
  maxCostUsd: z.number().positive().max(25).optional(),
  maxOutputLength: z.number().int().min(200).max(8000).optional(),
  endpointUrl: z.string().url().optional().or(z.literal("")),
  apiKeyHandling: z.string().max(120).optional(),
  submitterEmail: z.string().email().optional().or(z.literal("")),
});

function submissionLimit() {
  const configured = Number(process.env.AGENT_SUBMISSION_RATE_LIMIT_PER_DAY ?? 3);

  return Number.isFinite(configured) && configured > 0 ? configured : 3;
}

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const db = getPrisma();
    const submissions = await db.agentSubmission.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    return json({ submissions });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    if (process.env.PUBLIC_AGENT_SUBMISSIONS_ENABLED !== "true") {
      return json({ error: "Public agent submissions are not enabled yet." }, { status: 403 });
    }

    const body = await parseJson(request, submissionSchema);

    if (body.endpointUrl && process.env.EXTERNAL_AGENT_ENDPOINT_SUBMISSIONS_ENABLED !== "true") {
      return json({ error: "External endpoint submissions are not enabled yet." }, { status: 403 });
    }

    const fingerprint = getRequestFingerprint(request);
    const rateLimit = await consumeRateLimit({
      scope: "agent_submission",
      identifier: fingerprint,
      limit: submissionLimit(),
      windowMs: 24 * 60 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return json(
        { error: "Agent submission rate limit exceeded.", resetAt: rateLimit.resetAt.toISOString() },
        { status: 429 },
      );
    }

    const db = getPrisma();
    const submission = await db.agentSubmission.create({
      data: {
        name: body.name,
        ownerHandle: body.ownerHandle || undefined,
        ownerWallet: body.ownerWallet || undefined,
        category: body.category,
        description: body.description || undefined,
        provider: body.provider,
        modelName: body.modelName,
        systemPrompt: body.systemPrompt,
        maxCostUsd: body.maxCostUsd,
        maxOutputLength: body.maxOutputLength,
        endpointUrl: body.endpointUrl || undefined,
        apiKeyHandling: body.apiKeyHandling || "platform_provider_key",
        submitterEmail: body.submitterEmail || undefined,
        submitterIdentity: `anon:${fingerprint}`,
      },
    });

    await logEvent({
      type: "agent_submission.created",
      entityType: "agent_submission",
      entityId: submission.id,
      actor: `anon:${fingerprint}`,
      message: "Agent submission created.",
      metadata: {
        category: submission.category,
        provider: submission.provider,
        hasEndpoint: Boolean(submission.endpointUrl),
        rateLimitRemaining: rateLimit.remaining,
      },
    });

    return json({ submission, remaining: rateLimit.remaining }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
