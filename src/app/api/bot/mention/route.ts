import { z } from "zod";
import { createBattleFromWave, postBattleTo6529, runBattle } from "@/lib/data/battle-actions";
import { arenaCategories } from "@/lib/agents/internal-agents";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mentionSchema = z.object({
  waveId: z.string().min(1),
  dropId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).optional(),
  text: z.string().min(1),
  category: z.string().min(1).refine((category) => arenaCategories.includes(category), {
    message: "Unsupported battle category.",
  }).default("Wave Summarization"),
  agentIds: z.array(z.string()).min(2).max(2).refine((agentIds) => new Set(agentIds).size === agentIds.length, {
    message: "Selected battle agents must be distinct.",
  }).optional(),
  autoRun: z.boolean().default(true),
  autoPost: z.boolean().default(true),
  createPoll: z.boolean().default(false),
  maxMessages: z.number().int().min(1).max(5000).optional(),
  contextFrom: z.string().min(1).optional(),
  contextTo: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = await parseJson(request, mentionSchema);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const battle = await createBattleFromWave({
      waveId: body.waveId,
      triggerDropId: body.dropId,
      idempotencyKey:
        body.idempotencyKey ??
        request.headers.get("idempotency-key") ??
        `6529-mention:${body.waveId}:${body.dropId ?? body.text}`,
      requestText: body.text,
      category: body.category,
      source: "6529_mention",
      battleType: "official",
      isOfficial: true,
      maxMessages: body.maxMessages,
      contextFrom: body.contextFrom,
      contextTo: body.contextTo,
    });

    if (!body.autoRun) {
      return json({ battle }, { status: 201 });
    }

    const ranBattle = await runBattle({ battleId: battle.id, agentIds: body.agentIds });

    if (!body.autoPost) {
      return json({ battle: ranBattle }, { status: 201 });
    }

    const postedBattle = await postBattleTo6529({
      battleId: battle.id,
      appUrl,
      createPoll: body.createPoll,
    });

    return json({ battle: postedBattle }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
