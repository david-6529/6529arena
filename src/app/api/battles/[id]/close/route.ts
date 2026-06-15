import { closeBattle } from "@/lib/data/battle-actions";
import { handleRouteError, json, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const battle = await closeBattle(id);

    return json({ battle });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
