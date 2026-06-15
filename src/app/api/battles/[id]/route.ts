import { getBattleDetail } from "@/lib/data/queries";
import { handleRouteError, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const battle = await getBattleDetail(id);

    if (!battle) {
      return json({ error: "Battle not found." }, { status: 404 });
    }

    const isClosed = battle.status === "closed";

    return json({
      battle: {
        ...battle,
        entries: battle.entries.map(({ agent, ...entry }) => ({
          ...entry,
          agent: isClosed
            ? {
                id: agent.id,
                name: agent.name,
                slug: agent.slug,
                ownerHandle: agent.ownerHandle,
                category: agent.category,
                provider: agent.provider,
                modelName: agent.modelName,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
