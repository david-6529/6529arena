import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import {
  buildIdentityChallengeMessage,
  getIdentityWalletFromCookie,
  serializeIdentitySessionCookie,
  verifyIdentitySignature,
} from "@/lib/identity-auth";

describe("identity auth", () => {
  it("verifies signed challenge messages", async () => {
    const wallet = Wallet.createRandom();
    const message = buildIdentityChallengeMessage({
      wallet: wallet.address,
      nonce: "nonce",
      issuedAt: new Date("2026-06-15T12:00:00.000Z"),
      expiresAt: new Date("2026-06-15T12:10:00.000Z"),
    });
    const signature = await wallet.signMessage(message);

    expect(verifyIdentitySignature({ wallet: wallet.address, message, signature })).toBe(true);
    expect(
      verifyIdentitySignature({
        wallet: Wallet.createRandom().address,
        message,
        signature,
      }),
    ).toBe(false);
  });

  it("rejects malformed identity signatures", () => {
    const wallet = Wallet.createRandom();
    const message = buildIdentityChallengeMessage({
      wallet: wallet.address,
      nonce: "nonce",
      issuedAt: new Date("2026-06-15T12:00:00.000Z"),
      expiresAt: new Date("2026-06-15T12:10:00.000Z"),
    });

    expect(verifyIdentitySignature({ wallet: wallet.address, message, signature: "not-a-signature" })).toBe(false);
  });

  it("round-trips identity session cookies", () => {
    const wallet = Wallet.createRandom().address;
    const cookie = serializeIdentitySessionCookie(wallet);

    expect(getIdentityWalletFromCookie(cookie)).toBe(wallet.toLowerCase());
  });

  it("ignores malformed identity session cookies", () => {
    expect(getIdentityWalletFromCookie("agent_arena_identity=not-a-wallet.token")).toBeUndefined();
    expect(getIdentityWalletFromCookie("agent_arena_identity=wallet.token.extra")).toBeUndefined();
  });
});
