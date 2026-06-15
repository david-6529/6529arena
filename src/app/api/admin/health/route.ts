import { handleRouteError, json, requireAdmin } from "@/lib/api";
import { getSystemStatus } from "@/lib/system/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireAdmin(request);

    return json({ status: await getSystemStatus() });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
