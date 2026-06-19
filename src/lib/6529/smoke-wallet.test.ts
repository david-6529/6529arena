import { describe, expect, it } from "vitest";
import {
  default6529SmokeUsername,
  get6529SmokeWalletPublicSummary,
  render6529SmokeWalletEnv,
} from "@/lib/6529/smoke-wallet";

describe("6529 smoke wallet helpers", () => {
  it("renders dotenv content for the dedicated smoke wallet", () => {
    const env = render6529SmokeWalletEnv({
      walletAddress: "0x1111111111111111111111111111111111111111",
      privateKey: "0xprivate-test-key",
    });

    expect(env).toContain('6529_API_BASE_URL="https://api.6529.io"');
    expect(env).toContain('6529_MOCK_MODE="false"');
    expect(env).toContain('6529_BOT_WALLET_ADDRESS="0x1111111111111111111111111111111111111111"');
    expect(env).toContain('6529_BOT_PRIVATE_KEY="0xprivate-test-key"');
    expect(env).toContain(`6529_BOT_HANDLE="${default6529SmokeUsername}"`);
    expect(env).toContain(`6529_SMOKE_USERNAME="${default6529SmokeUsername}"`);
    expect(env).toContain('SIMPLE_LAUNCH_MODE="true"');
  });

  it("keeps public summaries free of private key fields", () => {
    const summary = get6529SmokeWalletPublicSummary({
      walletAddress: "0x2222222222222222222222222222222222222222",
      username: "  custom-test-user  ",
    });

    expect(summary).toEqual({
      walletAddress: "0x2222222222222222222222222222222222222222",
      username: "custom-test-user",
    });
    expect(Object.keys(summary)).not.toContain("privateKey");
  });
});
