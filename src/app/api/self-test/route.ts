import { z } from "zod";
import { runAgent } from "@/lib/agents/runAgent";
import { toAgentConfig } from "@/lib/data/queries";
import { getRequestFingerprint, handleRouteError, json, parseJson } from "@/lib/api";
import { getPrisma } from "@/lib/db/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const selfTestSchema = z.object({
  agentId: z.string().min(1),
  requestText: z.string().min(1).max(2000),
  contextText: z.string().min(1).max(30_000),
});

function selfTestLimit() {
  const configured = Number(process.env.SELF_TEST_RATE_LIMIT_PER_HOUR ?? 5);

  return Number.isFinite(configured) && configured > 0 ? configured : 5;
}

export async function POST(request: Request) {
  try {
    if (process.env.SELF_TEST_ENABLED !== "true") {
      return json({ error: "Self-test sandbox is disabled." }, { status: 403 });
    }

    const body = await parseJson(request, selfTestSchema);
    const fingerprint = getRequestFingerprint(request);
    const rateLimit = await consumeRateLimit({
      scope: "self_test",
      identifier: fingerprint,
      limit: selfTestLimit(),
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return json(
        { error: "Self-test rate limit exceeded.", resetAt: rateLimit.resetAt.toISOString() },
        { status: 429 },
      );
    }

    const db = getPrisma();
    const agent = await db.agent.findFirst({
      where: {
        id: body.agentId,
        isActive: true,
      },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!agent) {
      return json({ error: "Agent not found." }, { status: 404 });
    }

    const agentConfig = toAgentConfig(agent);
    const input = {
      waveId: "self-test",
      requestText: body.requestText,
      drops: [
        {
          id: "self-test-context",
          serial_no: 1,
          created_at: Date.now(),
          content: body.contextText,
          author: { handle: "self-test" },
        },
      ],
    };
    const result = await runAgent(agentConfig, input);
    const run = await db.agentRun.create({
      data: {
        agentId: agentConfig.id,
        agentVersionId: agentConfig.versionId,
        inputJson: input,
        output: result.rawOutput,
        status: "completed",
        runType: "self_test",
        provider: agentConfig.provider,
        modelName: agentConfig.modelName,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
      },
    });

    await logEvent({
      type: "self_test.completed",
      entityType: "agent_run",
      entityId: run.id,
      actor: `anon:${fingerprint}`,
      message: "Self-test run completed.",
      metadata: {
        agentId: agentConfig.id,
        agentVersionId: agentConfig.versionId,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
      },
    });

    return json({
      runId: run.id,
      output: result.renderedOutput,
      structured: result.structured,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      remaining: rateLimit.remaining,
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
