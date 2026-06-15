import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  getAdminSessionToken,
} from "@/lib/admin-auth";
import { getRequestFingerprint, handleRouteError, json, parseJson } from "@/lib/api";
import { hasDatabaseUrl } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  adminKey: z.string().min(1),
});

function adminLoginLimit() {
  const configured = Number(process.env.ADMIN_LOGIN_RATE_LIMIT_PER_HOUR ?? 10);

  return Number.isFinite(configured) && configured > 0 ? configured : 10;
}

export async function POST(request: Request) {
  try {
    const configuredKey = process.env.ADMIN_API_KEY;

    if (!configuredKey) {
      return json({ ok: true, message: "ADMIN_API_KEY is not configured; admin pages are open in this environment." });
    }

    if (hasDatabaseUrl()) {
      const fingerprint = getRequestFingerprint(request);
      const rateLimit = await consumeRateLimit({
        scope: "admin_login",
        identifier: fingerprint,
        limit: adminLoginLimit(),
        windowMs: 60 * 60 * 1000,
      });

      if (!rateLimit.allowed) {
        await logEvent({
          type: "admin.login_rate_limited",
          severity: "warn",
          message: "Admin login rate limit exceeded.",
          actor: `anon:${fingerprint}`,
          metadata: {
            resetAt: rateLimit.resetAt.toISOString(),
          },
        });

        return json(
          { error: "Too many admin login attempts.", resetAt: rateLimit.resetAt.toISOString() },
          { status: 429 },
        );
      }
    }

    const body = await parseJson(request, loginSchema);

    if (body.adminKey !== configuredKey) {
      await logEvent({
        type: "admin.login_failed",
        severity: "warn",
        message: "Admin login failed.",
      });

      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = getAdminSessionToken();

    if (!token) {
      return json({ error: "Admin session could not be created." }, { status: 500 });
    }

    await logEvent({
      type: "admin.login",
      message: "Admin session created.",
    });

    return json(
      { ok: true },
      {
        headers: {
          "set-cookie": `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ADMIN_SESSION_MAX_AGE_SECONDS}${
            process.env.NODE_ENV === "production" ? "; Secure" : ""
          }`,
        },
      },
    );
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function DELETE() {
  await logEvent({
    type: "admin.logout",
    message: "Admin session cleared.",
  });

  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
          process.env.NODE_ENV === "production" ? "; Secure" : ""
        }`,
      },
    },
  );
}
