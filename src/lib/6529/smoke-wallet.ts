export const default6529SmokeWalletEnvPath = ".env.6529-smoke.local";
export const default6529SmokeUsername = "testing12345";

export type SmokeWalletEnvInput = {
  walletAddress: string;
  privateKey: string;
  username?: string;
  apiBaseUrl?: string;
  botHandle?: string;
  mockMode?: boolean;
  simpleLaunchMode?: boolean;
};

function quoteEnv(value: string) {
  return JSON.stringify(value);
}

export function render6529SmokeWalletEnv(input: SmokeWalletEnvInput) {
  const username = input.username?.trim() || default6529SmokeUsername;

  return [
    "# 6529 smoke-test bot wallet.",
    "# Generated locally. Do not commit, paste, or share the private key.",
    `6529_API_BASE_URL=${quoteEnv(input.apiBaseUrl ?? "https://api.6529.io")}`,
    `6529_MOCK_MODE=${quoteEnv(String(input.mockMode ?? false))}`,
    `6529_BOT_WALLET_ADDRESS=${quoteEnv(input.walletAddress)}`,
    `6529_BOT_PRIVATE_KEY=${quoteEnv(input.privateKey)}`,
    `6529_BOT_HANDLE=${quoteEnv(input.botHandle?.trim() || username)}`,
    `6529_SMOKE_USERNAME=${quoteEnv(username)}`,
    `SIMPLE_LAUNCH_MODE=${quoteEnv(String(input.simpleLaunchMode ?? true))}`,
    "",
  ].join("\n");
}

export function get6529SmokeWalletPublicSummary(input: Pick<SmokeWalletEnvInput, "walletAddress" | "username">) {
  return {
    walletAddress: input.walletAddress,
    username: input.username?.trim() || default6529SmokeUsername,
  };
}
