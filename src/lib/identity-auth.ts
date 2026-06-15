import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, verifyMessage } from "ethers";
import { parseCookieHeader } from "@/lib/admin-auth";

export const IDENTITY_SESSION_COOKIE = "agent_arena_identity";
export const IDENTITY_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type ChallengeMessageInput = {
  wallet: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
};

export function normalizeWalletAddress(value: string) {
  return getAddress(value).toLowerCase();
}

export function checksumWalletAddress(value: string) {
  return getAddress(value);
}

export function createIdentityNonce() {
  return randomBytes(16).toString("hex");
}

export function buildIdentityChallengeMessage(input: ChallengeMessageInput) {
  return [
    "6529 Agent Arena wallet link",
    "",
    `Wallet: ${checksumWalletAddress(input.wallet)}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expires At: ${input.expiresAt.toISOString()}`,
    "",
    "Sign this message to link your wallet to your Agent Arena identity.",
    "This does not grant spending permissions.",
  ].join("\n");
}

export function verifyIdentitySignature(params: {
  wallet: string;
  message: string;
  signature: string;
}) {
  let signer: string;

  try {
    signer = verifyMessage(params.message, params.signature);
  } catch {
    return false;
  }

  return normalizeWalletAddress(signer) === normalizeWalletAddress(params.wallet);
}

function identitySessionSecret() {
  return process.env.RATE_LIMIT_SALT ?? process.env.ADMIN_API_KEY ?? "agent-arena-dev";
}

export function getIdentitySessionToken(wallet: string) {
  return createHash("sha256")
    .update(`${identitySessionSecret()}:identity-session:${normalizeWalletAddress(wallet)}`)
    .digest("hex");
}

export function serializeIdentitySessionCookie(wallet: string) {
  const normalizedWallet = normalizeWalletAddress(wallet);
  const value = `${normalizedWallet}.${getIdentitySessionToken(normalizedWallet)}`;

  return `${IDENTITY_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${IDENTITY_SESSION_MAX_AGE_SECONDS}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function clearIdentitySessionCookie() {
  return `${IDENTITY_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function getIdentityWalletFromCookie(cookieHeader?: string | null) {
  const cookies = parseCookieHeader(cookieHeader);
  const value = cookies.get(IDENTITY_SESSION_COOKIE);

  if (!value) {
    return undefined;
  }

  const parts = value.split(".");

  if (parts.length !== 2) {
    return undefined;
  }

  const [wallet, token] = parts;

  if (!wallet || !token) {
    return undefined;
  }

  let expected: string;

  try {
    expected = getIdentitySessionToken(wallet);
  } catch {
    return undefined;
  }

  if (expected.length !== token.length) {
    return undefined;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(token))
    ? normalizeWalletAddress(wallet)
    : undefined;
}
