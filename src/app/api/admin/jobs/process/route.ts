import { z } from "zod";
import { getBearerTokenFromRequest, handleRouteError, json, requireAdmin } from "@/lib/api";
import { processBattleJobs } from "@/lib/data/jobs";
import { logEvent } from "@/lib/observability/events";
import { runOperationalMaintenance } from "@/lib/ops/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const processSchema = z.object({
  limit: z.number().int().min(1).max(10).default(1),
  workerId: z.string().min(1).optional(),
});

function requireWorkerAuth(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = getBearerTokenFromRequest(request);

  if (cronSecret && bearer === cronSecret) {
    return;
  }

  requireAdmin(request);
}

export async function POST(request: Request) {
  try {
    requireWorkerAuth(request);
    const payload = await request.json().catch(() => ({}));
    const body = processSchema.parse(payload);
    const jobs = await processBattleJobs(body);
    const maintenance = await runOperationalMaintenance();

    await logEvent({
      type: "admin.jobs_processed",
      entityType: "battle_job",
      actor: "operator_or_cron",
      message: "Operator or cron processed queued jobs.",
      metadata: {
        method: "POST",
        requestedLimit: body.limit,
        processed: jobs.length,
        maintenance,
      },
    });

    return json({ processed: jobs.length, jobs, maintenance });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function GET(request: Request) {
  try {
    requireWorkerAuth(request);
    const url = new URL(request.url);
    const parsedLimit = Number(url.searchParams.get("limit") ?? 2);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 2;
    const jobs = await processBattleJobs({ limit });
    const maintenance = await runOperationalMaintenance();

    await logEvent({
      type: "admin.jobs_processed",
      entityType: "battle_job",
      actor: "operator_or_cron",
      message: "Operator or cron processed queued jobs.",
      metadata: {
        method: "GET",
        requestedLimit: limit,
        processed: jobs.length,
        maintenance,
      },
    });

    return json({ processed: jobs.length, jobs, maintenance });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
