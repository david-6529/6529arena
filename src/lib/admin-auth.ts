import { createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "agent_arena_admin";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export function getAdminSessionToken() {
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    return undefined;
  }

  const salt = process.env.RATE_LIMIT_SALT ?? adminKey;

  return createHash("sha256").update(`${salt}:admin-session:${adminKey}`).digest("hex");
}

export function isValidAdminSessionToken(value?: string | null) {
  const expected = getAdminSessionToken();

  if (!value || !expected || value.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export function parseCookieHeader(cookieHeader?: string | null) {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");

    if (!name) {
      continue;
    }

    cookies.set(name, decodeURIComponent(valueParts.join("=")));
  }

  return cookies;
}
