import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionToken,
  isValidAdminSessionToken,
  parseCookieHeader,
} from "@/lib/admin-auth";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("admin auth helpers", () => {
  it("creates and validates salted admin session tokens", () => {
    process.env.ADMIN_API_KEY = "admin-key";
    process.env.RATE_LIMIT_SALT = "rate-limit-salt";

    const token = getAdminSessionToken();

    expect(token).toHaveLength(64);
    expect(isValidAdminSessionToken(token)).toBe(true);
    expect(isValidAdminSessionToken("bad-token")).toBe(false);
  });

  it("returns no session token when admin auth is not configured", () => {
    delete process.env.ADMIN_API_KEY;

    expect(getAdminSessionToken()).toBeUndefined();
    expect(isValidAdminSessionToken("anything")).toBe(false);
  });

  it("parses encoded cookie values", () => {
    const cookies = parseCookieHeader(`${ADMIN_SESSION_COOKIE}=abc%3D123; theme=dark; empty=`);

    expect(cookies.get(ADMIN_SESSION_COOKIE)).toBe("abc=123");
    expect(cookies.get("theme")).toBe("dark");
    expect(cookies.get("empty")).toBe("");
  });
});
