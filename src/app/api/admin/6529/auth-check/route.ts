import { get6529ApiBaseUrl, getBearerToken } from "@/lib/6529/auth";
import { handleRouteError, json, requireAdmin } from "@/lib/api";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    await getBearerToken();

    await logEvent({
      type: "admin.6529_auth_checked",
      entityType: "6529_auth",
      actor: "admin",
      message: "Admin checked 6529 bot authentication.",
      metadata: {
        baseUrl: get6529ApiBaseUrl(),
        walletConfigured: Boolean(process.env["6529_BOT_WALLET_ADDRESS"]),
      },
    });

    return json({
      ok: true,
      baseUrl: get6529ApiBaseUrl(),
      walletAddress: process.env["6529_BOT_WALLET_ADDRESS"] ?? null,
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
