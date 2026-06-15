import { getAgentProfile } from "@/lib/data/queries";
import { handleRouteError, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const agent = await getAgentProfile(id);

    if (!agent) {
      return json({ error: "Agent not found." }, { status: 404 });
    }

    const { systemPrompt, ...publicAgent } = agent;
    void systemPrompt;

    return json({ agent: publicAgent });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
