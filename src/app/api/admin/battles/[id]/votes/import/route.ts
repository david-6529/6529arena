import { z } from "zod";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { recordVote } from "@/lib/data/votes";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const importedVoteSchema = z.object({
  selectedLabel: z.enum(["A", "B", "C"]),
  voterHandle: z.string().min(1).optional(),
  voterWallet: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  source: z.string().min(1).default("6529_import"),
  weight: z.number().positive().max(10).default(1),
});

const importSchema = z.object({
  votes: z.array(importedVoteSchema).min(1).max(500),
  allowClosed: z.boolean().default(false),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJson(request, importSchema);
    const results = await Promise.all(
      body.votes.map((vote) =>
        recordVote({
          battleId: id,
          selectedLabel: vote.selectedLabel,
          voterHandle: vote.voterHandle,
          voterWallet: vote.voterWallet,
          externalId: vote.externalId,
          source: vote.source,
          weight: vote.weight,
          allowClosed: body.allowClosed,
          actor: "admin_import",
        }),
      ),
    );

    await logEvent({
      type: "votes.imported",
      battleId: id,
      entityType: "battle",
      entityId: id,
      actor: "admin",
      message: "Imported external vote records.",
      metadata: {
        count: results.length,
        sources: [...new Set(body.votes.map((vote) => vote.source))],
      },
    });

    return json({
      imported: results.length,
      votes: results.map((result) => result.vote),
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
