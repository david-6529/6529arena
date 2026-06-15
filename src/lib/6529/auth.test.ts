import { afterEach, describe, expect, it } from "vitest";
import { verifyMessage, Wallet } from "ethers";
import { get6529ApiBaseUrl, signNonce } from "@/lib/6529/auth";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("6529 auth helpers", () => {
  it("normalizes the API base URL with a single /api suffix", () => {
    process.env["6529_API_BASE_URL"] = "https://api.6529.io";
    expect(get6529ApiBaseUrl()).toBe("https://api.6529.io/api");

    process.env["6529_API_BASE_URL"] = "https://api.6529.io/api/";
    expect(get6529ApiBaseUrl()).toBe("https://api.6529.io/api");
  });

  it("signs nonces with the configured bot private key", async () => {
    const wallet = Wallet.createRandom();
    const signature = await signNonce("nonce-123", wallet.privateKey);

    expect(verifyMessage("nonce-123", signature)).toBe(wallet.address);
  });

  it("requires a private key for nonce signing", async () => {
    delete process.env["6529_BOT_PRIVATE_KEY"];

    await expect(signNonce("nonce-123")).rejects.toThrow("6529_BOT_PRIVATE_KEY is required");
  });
});
