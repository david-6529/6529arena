import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  getBearerTokenFromRequest,
  getClientIp,
  getRequestFingerprint,
  handleRouteError,
  parseJson,
  requireAdmin,
} from "@/lib/api";
import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/observability/events", () => ({
  logEvent: vi.fn(),
}));

vi.mock("@/lib/observability/telemetry", () => ({
  captureTelemetryException: vi.fn(),
}));

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

function request(init: RequestInit = {}) {
  return new Request("https://arena.example/api/test", init);
}

describe("api request helpers", () => {
  it("extracts bearer tokens and client IPs", () => {
    expect(getBearerTokenFromRequest(request({ headers: { authorization: "Bearer token-123" } }))).toBe("token-123");
    expect(getBearerTokenFromRequest(request({ headers: { authorization: "Basic abc" } }))).toBeUndefined();
    expect(getClientIp(request({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }))).toBe("1.2.3.4");
    expect(getClientIp(request({ headers: { "x-real-ip": "9.9.9.9" } }))).toBe("9.9.9.9");
  });

  it("builds stable salted request fingerprints", () => {
    process.env.RATE_LIMIT_SALT = "salt";
    const first = getRequestFingerprint(request({ headers: { "x-real-ip": "1.1.1.1", "user-agent": "agent" } }));
    const second = getRequestFingerprint(request({ headers: { "x-real-ip": "1.1.1.1", "user-agent": "agent" } }));

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it("requires admin credentials when an admin key is configured", () => {
    process.env.ADMIN_API_KEY = "secret";
    process.env.RATE_LIMIT_SALT = "salt";
    const sessionToken = getAdminSessionToken();

    expect(() => requireAdmin(request({ headers: { "x-admin-api-key": "secret" } }))).not.toThrow();
    expect(() => requireAdmin(request({ headers: { authorization: "Bearer secret" } }))).not.toThrow();
    expect(() =>
      requireAdmin(request({ headers: { cookie: `${ADMIN_SESSION_COOKIE}=${sessionToken}` } })),
    ).not.toThrow();
    expect(() => requireAdmin(request())).toThrow("Unauthorized");
  });

  it("parses valid JSON and rejects invalid payloads", async () => {
    const schema = z.object({ name: z.string().min(2) });

    await expect(parseJson(request({ method: "POST", body: JSON.stringify({ name: "ok" }) }), schema)).resolves.toEqual({
      name: "ok",
    });
    await expect(parseJson(request({ method: "POST", body: JSON.stringify({ name: "x" }) }), schema)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns public error messages for 4xx errors and masks 5xx errors", async () => {
    const clientError = await handleRouteError(Object.assign(new Error("Bad input"), { status: 422 })).json();
    const serverResponse = handleRouteError(new Error("Database exploded"));
    const serverError = await serverResponse.json();

    expect(clientError).toMatchObject({ error: "Bad input" });
    expect(serverResponse.status).toBe(500);
    expect(serverError.error).toBe("Unexpected error");
    expect(serverError.errorId).toEqual(expect.any(String));
  });
});
