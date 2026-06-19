import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemStatus } from "@/lib/system/health";
import { hasDatabaseUrl, prisma } from "@/lib/db/prisma";

vi.mock("@/lib/6529/auth", () => ({
  get6529ApiBaseUrl: () => "https://api.6529.io",
}));

vi.mock("@/lib/db/prisma", () => ({
  hasDatabaseUrl: vi.fn(),
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  vi.mocked(hasDatabaseUrl).mockReset();
  vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  vi.mocked(prisma!.$queryRaw).mockReset();
  vi.mocked(prisma!.$queryRaw).mockResolvedValue([{ "?column?": 1 }] as never);
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function setReadyEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "https://arena.example";
  process.env.ADMIN_API_KEY = "admin";
  process.env.CRON_SECRET = "cron";
  process.env.RATE_LIMIT_SALT = "salt";
  process.env["6529_BOT_WALLET_ADDRESS"] = "0xbot";
  process.env["6529_BOT_PRIVATE_KEY"] = "private";
  process.env.WAVE_BRIEF_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "openai-key";
}

describe("getSystemStatus", () => {
  it("requires the configured wave-summary provider key for production readiness", async () => {
    setReadyEnv();
    process.env.WAVE_BRIEF_PROVIDER = "openai";
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    delete process.env.OPENAI_API_KEY;

    const status = await getSystemStatus();

    expect(status.aiProviders).toContainEqual({ provider: "anthropic", configured: true });
    expect(status.waveBriefProvider).toEqual({
      provider: "openai",
      keyName: "OPENAI_API_KEY",
      configured: false,
    });
    expect(status.readyForProduction).toBe(false);
  });

  it("marks the selected wave-summary provider as configured when its key is present", async () => {
    setReadyEnv();
    process.env.WAVE_BRIEF_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "anthropic-key";

    const status = await getSystemStatus();

    expect(status.waveBriefProvider).toEqual({
      provider: "anthropic",
      keyName: "ANTHROPIC_API_KEY",
      configured: true,
    });
    expect(status.readyForProduction).toBe(true);
  });

  it("requires a positive wave-summary generation rate limit", async () => {
    setReadyEnv();
    process.env.WAVE_BRIEF_RATE_LIMIT_PER_HOUR = "0";

    const status = await getSystemStatus();

    expect(status.rateLimits.waveBriefPerHour).toBeNull();
    expect(status.readyForProduction).toBe(false);
  });

  it("requires an integer wave-summary generation rate limit", async () => {
    setReadyEnv();
    process.env.WAVE_BRIEF_RATE_LIMIT_PER_HOUR = "0.5";

    const status = await getSystemStatus();

    expect(status.rateLimits.waveBriefPerHour).toBeNull();
    expect(status.readyForProduction).toBe(false);
  });

  it("requires a production https app URL", async () => {
    setReadyEnv();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:5001";

    const status = await getSystemStatus();

    expect(status.app).toEqual({
      publicUrl: "http://localhost:5001",
      productionUrlConfigured: false,
    });
    expect(status.readyForProduction).toBe(false);
  });

  it("requires cron auth and rate-limit salt for production readiness", async () => {
    setReadyEnv();
    delete process.env.CRON_SECRET;
    delete process.env.RATE_LIMIT_SALT;

    const status = await getSystemStatus();

    expect(status.security.cronSecretConfigured).toBe(false);
    expect(status.security.rateLimitSaltConfigured).toBe(false);
    expect(status.readyForProduction).toBe(false);
  });
});
