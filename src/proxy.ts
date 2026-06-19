import { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE = "agent_arena_admin";

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function expectedAdminSessionToken() {
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    return undefined;
  }

  const salt = process.env.RATE_LIMIT_SALT ?? adminKey;

  return sha256Hex(`${salt}:admin-session:${adminKey}`);
}

export async function proxy(request: NextRequest) {
  const adminKey = process.env.ADMIN_API_KEY;
  const pathname = request.nextUrl.pathname;

  if (!adminKey || pathname === "/admin/login" || pathname === "/operator/login") {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const expected = await expectedAdminSessionToken();

  if (sessionToken && expected && sessionToken === expected) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/operator/login";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/operator/:path*"],
};
