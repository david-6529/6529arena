import { handleRouteError, json, requireAdmin } from "@/lib/api";
import { listWaveTasks } from "@/lib/data/wave-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireAdmin(request);

    return json({ tasks: await listWaveTasks() });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
