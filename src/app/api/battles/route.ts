import { z } from "zod";
import { createBattleFromWave } from "@/lib/data/battle-actions";
import { listBattles } from "@/lib/data/queries";
import { arenaCategories } from "@/lib/agents/internal-agents";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBattleSchema = z.object({
  waveId: z.string().min(1),
  triggerDropId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).optional(),
  requestText: z.string().min(1),
  category: z.string().min(1).refine((category) => arenaCategories.includes(category), {
    message: "Unsupported battle category.",
  }).default("Wave Summarization"),
  source: z.string().min(1).default("manual"),
  battleType: z.enum(["official", "test"]).default("official"),
  isOfficial: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  maxMessages: z.number().int().min(1).max(5000).optional(),
  contextFrom: z.string().min(1).optional(),
  contextTo: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    requireAdmin(request);

    return json({ battles: await listBattles() });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = await parseJson(request, createBattleSchema);
    const battle = await createBattleFromWave({
      ...body,
      idempotencyKey: body.idempotencyKey ?? request.headers.get("idempotency-key") ?? undefined,
    });

    return json({ battle }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
