import { getRequestFingerprint, handleRouteError, json, requireAdmin } from "@/lib/api";
import { logEvent } from "@/lib/observability/events";
import { runOperationalMaintenance } from "@/lib/ops/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireAdmin(request);

    const maintenance = await runOperationalMaintenance();

    await logEvent({
      type: "admin.maintenance_run",
      actor: getRequestFingerprint(request),
      message: "Admin manually ran operational maintenance.",
      metadata: maintenance,
    });

    return json({ maintenance });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
