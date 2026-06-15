import { getRequestFingerprint, handleRouteError, json, requireAdmin } from "@/lib/api";
import { deactivateAgent } from "@/lib/data/admin-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const agent = await deactivateAgent({
      agentId: id,
      actor: getRequestFingerprint(request),
    });

    return json({ agent });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
