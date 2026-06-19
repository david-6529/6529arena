import { get6529ApiBaseUrl } from "@/lib/6529/auth";
import { hasDatabaseUrl, prisma } from "@/lib/db/prisma";

export type SystemStatus = {
  app: {
    publicUrl: string | null;
    productionUrlConfigured: boolean;
  };
  database: {
    configured: boolean;
    reachable: boolean;
    error?: string;
  };
  security: {
    adminKeyConfigured: boolean;
    cronSecretConfigured: boolean;
    rateLimitSaltConfigured: boolean;
    walletConnectConfigured: boolean;
  };
  api6529: {
    baseUrl: string;
    mockMode: boolean;
    botWalletConfigured: boolean;
    botPrivateKeyConfigured: boolean;
    readyToPost: boolean;
  };
  aiProviders: Array<{
    provider: "openai" | "anthropic" | "google";
    configured: boolean;
  }>;
  waveBriefProvider: {
    provider: "openai" | "anthropic" | "google";
    keyName: string;
    configured: boolean;
  };
  costCaps: {
    waveBriefEstimatedCostUsd: number | null;
    battleEstimatedCostUsd: number | null;
  };
  rateLimits: {
    waveBriefPerHour: number | null;
  };
  readyForProduction: boolean;
};

function positiveNumberEnv(name: string, fallback?: number) {
  const raw = process.env[name] ?? (fallback === undefined ? undefined : String(fallback));
  const value = Number(raw);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function positiveIntegerEnv(name: string, fallback?: number) {
  const raw = process.env[name] ?? (fallback === undefined ? undefined : String(fallback));
  const value = Number(raw);

  return Number.isInteger(value) && value > 0 ? value : null;
}

function configuredWaveBriefProvider(): "openai" | "anthropic" | "google" {
  const provider = process.env.WAVE_BRIEF_PROVIDER;

  return provider === "anthropic" || provider === "google" || provider === "openai" ? provider : "openai";
}

function providerKeyName(provider: "openai" | "anthropic" | "google") {
  if (provider === "anthropic") {
    return "ANTHROPIC_API_KEY";
  }

  if (provider === "google") {
    return "GOOGLE_API_KEY";
  }

  return "OPENAI_API_KEY";
}

function configuredSecret(name: string) {
  return Boolean(process.env[name]?.trim());
}

function productionUrlConfigured(value: string | null) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      host !== "localhost" &&
      !host.endsWith(".localhost") &&
      host !== "127.0.0.1" &&
      host !== "::1" &&
      host !== "[::1]"
    );
  } catch {
    return false;
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  let databaseReachable = false;
  let databaseError: string | undefined;

  if (prisma) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseReachable = true;
    } catch (error) {
      databaseError = error instanceof Error ? error.message : "Database check failed.";
    }
  }

  const aiProviders = [
    { provider: "openai" as const, configured: configuredSecret("OPENAI_API_KEY") },
    { provider: "anthropic" as const, configured: configuredSecret("ANTHROPIC_API_KEY") },
    { provider: "google" as const, configured: configuredSecret("GOOGLE_API_KEY") },
  ];
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || null;
  const botWalletConfigured = configuredSecret("6529_BOT_WALLET_ADDRESS");
  const botPrivateKeyConfigured = configuredSecret("6529_BOT_PRIVATE_KEY");
  const adminKeyConfigured = configuredSecret("ADMIN_API_KEY");
  const cronSecretConfigured = configuredSecret("CRON_SECRET");
  const rateLimitSaltConfigured = configuredSecret("RATE_LIMIT_SALT");
  const mockMode = process.env["6529_MOCK_MODE"] === "true";
  const readyToPost = botWalletConfigured && botPrivateKeyConfigured;
  const waveBriefProviderName = configuredWaveBriefProvider();
  const waveBriefProviderKey = providerKeyName(waveBriefProviderName);
  const waveBriefProvider = {
    provider: waveBriefProviderName,
    keyName: waveBriefProviderKey,
    configured: configuredSecret(waveBriefProviderKey),
  };
  const app = {
    publicUrl,
    productionUrlConfigured: productionUrlConfigured(publicUrl),
  };
  const costCaps = {
    waveBriefEstimatedCostUsd: positiveNumberEnv("MAX_WAVE_BRIEF_ESTIMATED_COST_USD", 0.25),
    battleEstimatedCostUsd: positiveNumberEnv("MAX_BATTLE_ESTIMATED_COST_USD", 1),
  };
  const rateLimits = {
    waveBriefPerHour: positiveIntegerEnv("WAVE_BRIEF_RATE_LIMIT_PER_HOUR", 10),
  };

  return {
    app,
    database: {
      configured: hasDatabaseUrl(),
      reachable: databaseReachable,
      error: databaseError,
    },
    security: {
      adminKeyConfigured,
      cronSecretConfigured,
      rateLimitSaltConfigured,
      walletConnectConfigured: Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
    },
    api6529: {
      baseUrl: get6529ApiBaseUrl(),
      mockMode,
      botWalletConfigured,
      botPrivateKeyConfigured,
      readyToPost,
    },
    aiProviders,
    waveBriefProvider,
    costCaps,
    rateLimits,
    readyForProduction:
      hasDatabaseUrl() &&
      databaseReachable &&
      app.productionUrlConfigured &&
      adminKeyConfigured &&
      cronSecretConfigured &&
      rateLimitSaltConfigured &&
      readyToPost &&
      waveBriefProvider.configured &&
      !mockMode &&
      costCaps.waveBriefEstimatedCostUsd !== null &&
      rateLimits.waveBriefPerHour !== null,
  };
}
