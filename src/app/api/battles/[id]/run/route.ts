import { z } from "zod";
import { runBattle } from "@/lib/data/battle-actions";
import { enqueueBattleRun } from "@/lib/data/jobs";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const runBattleSchema = z.object({
  agentIds: z.array(z.string()).min(2).max(2).refine((agentIds) => new Set(agentIds).size === agentIds.length, {
    message: "Selected battle agents must be distinct.",
  }).optional(),
  mode: z.enum(["queued", "sync"]).default("queued"),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJson(request, runBattleSchema);

    if (body.mode === "queued") {
      const job = await enqueueBattleRun({ battleId: id, agentIds: body.agentIds });

      return json({ job }, { status: 202 });
    }

    const battle = await runBattle({ battleId: id, agentIds: body.agentIds });

    return json({ battle });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
