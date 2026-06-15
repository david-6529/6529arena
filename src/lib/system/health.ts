import { get6529ApiBaseUrl } from "@/lib/6529/auth";
import { hasDatabaseUrl, prisma } from "@/lib/db/prisma";

export type SystemStatus = {
  database: {
    configured: boolean;
    reachable: boolean;
    error?: string;
  };
  security: {
    adminKeyConfigured: boolean;
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
  readyForProduction: boolean;
};

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
    { provider: "openai" as const, configured: Boolean(process.env.OPENAI_API_KEY) },
    { provider: "anthropic" as const, configured: Boolean(process.env.ANTHROPIC_API_KEY) },
    { provider: "google" as const, configured: Boolean(process.env.GOOGLE_API_KEY) },
  ];
  const botWalletConfigured = Boolean(process.env["6529_BOT_WALLET_ADDRESS"]);
  const botPrivateKeyConfigured = Boolean(process.env["6529_BOT_PRIVATE_KEY"]);
  const adminKeyConfigured = Boolean(process.env.ADMIN_API_KEY);
  const mockMode = process.env["6529_MOCK_MODE"] === "true";
  const readyToPost = botWalletConfigured && botPrivateKeyConfigured;
  const hasAiProvider = aiProviders.some((provider) => provider.configured);

  return {
    database: {
      configured: hasDatabaseUrl(),
      reachable: databaseReachable,
      error: databaseError,
    },
    security: {
      adminKeyConfigured,
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
    readyForProduction: hasDatabaseUrl() && databaseReachable && adminKeyConfigured && readyToPost && hasAiProvider && !mockMode,
  };
}
