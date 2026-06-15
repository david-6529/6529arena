import { getAgents } from "@/lib/data/queries";
import { handleRouteError, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const agents = await getAgents();

    return json({
      agents: agents.map((agent) => {
        const { systemPrompt, ...publicAgent } = agent;
        void systemPrompt;
        return publicAgent;
      }),
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
