import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken, parseCookieHeader } from "@/lib/admin-auth";
import { logEvent } from "@/lib/observability/events";
import { captureTelemetryException } from "@/lib/observability/telemetry";

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function getBearerTokenFromRequest(request: Request) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length);
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "unknown";
}

export function getRequestFingerprint(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.ADMIN_API_KEY ?? "agent-arena-dev";

  return createHash("sha256").update(`${salt}:${ip}:${userAgent}`).digest("hex");
}

export function requireAdmin(request: Request) {
  const configuredKey = process.env.ADMIN_API_KEY;

  if (!configuredKey) {
    return;
  }

  const headerKey = request.headers.get("x-admin-api-key");
  const bearer = getBearerTokenFromRequest(request);
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const sessionToken = cookies.get(ADMIN_SESSION_COOKIE);

  if (headerKey !== configuredKey && bearer !== configuredKey && !isValidAdminSessionToken(sessionToken)) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
}

export async function parseJson<T extends z.ZodType>(request: Request, schema: T) {
  const payload = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw Object.assign(new Error(z.prettifyError(parsed.error)), { status: 400 });
  }

  return parsed.data as z.infer<T>;
}

function getErrorStatus(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status: unknown }).status)
      : 500;

  return Number.isFinite(status) && status >= 400 && status <= 599 ? status : 500;
}

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : undefined;
}

export function handleRouteError(error: unknown, request?: Request) {
  const errorId = randomUUID();
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = getErrorStatus(error);
  const responseMessage = status >= 500 ? "Unexpected error" : message;
  const code = getErrorCode(error);

  void logEvent({
    type: "api.route_error",
    severity: status >= 500 ? "error" : "warn",
    message,
    actor: request ? getRequestFingerprint(request) : undefined,
    metadata: {
      errorId,
      status,
      code,
      method: request?.method,
      url: request?.url,
      name: error instanceof Error ? error.name : typeof error,
      stack: status >= 500 && error instanceof Error ? error.stack : undefined,
    },
  });

  if (status >= 500) {
    console.error(`[api.route_error:${errorId}]`, error);
    void captureTelemetryException(error, {
      errorId,
      status,
      code,
      method: request?.method,
      url: request?.url,
    });
  }

  return json({ error: responseMessage, errorId, code }, { status });
}
