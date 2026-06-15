import { z } from "zod";
import { getRequestFingerprint, handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { createAgentVersion } from "@/lib/data/admin-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createVersionSchema = z.object({
  provider: z.string().trim().min(1),
  modelName: z.string().trim().min(1),
  systemPrompt: z.string().trim().min(20),
  maxCostUsd: z.number().positive().nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  activate: z.boolean().default(true),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const body = await parseJson(request, createVersionSchema);
    const result = await createAgentVersion({
      agentId: id,
      ...body,
      actor: getRequestFingerprint(request),
    });

    return json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
