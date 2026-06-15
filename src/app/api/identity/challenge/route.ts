import { z } from "zod";
import {
  buildIdentityChallengeMessage,
  checksumWalletAddress,
  createIdentityNonce,
  normalizeWalletAddress,
} from "@/lib/identity-auth";
import { getRequestFingerprint, handleRouteError, json, parseJson } from "@/lib/api";
import { getPrisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const challengeSchema = z.object({
  wallet: z.string().min(1),
});

function challengeLimit() {
  const configured = Number(process.env.IDENTITY_CHALLENGE_RATE_LIMIT_PER_HOUR ?? 20);
  return Number.isFinite(configured) && configured > 0 ? configured : 20;
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, challengeSchema);
    const wallet = normalizeWalletAddress(body.wallet);
    const fingerprint = getRequestFingerprint(request);
    const db = getPrisma();
    const rateLimit = await consumeRateLimit({
      scope: "identity_challenge",
      identifier: fingerprint,
      limit: challengeLimit(),
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return json(
        { error: "Wallet challenge rate limit exceeded.", resetAt: rateLimit.resetAt.toISOString() },
        { status: 429 },
      );
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 10 * 60 * 1000);
    const nonce = createIdentityNonce();
    const message = buildIdentityChallengeMessage({
      wallet,
      nonce,
      issuedAt,
      expiresAt,
    });

    await db.identity.upsert({
      where: { wallet },
      update: {},
      create: {
        wallet,
        source: "wallet_challenge",
      },
    });

    const challenge = await db.identityChallenge.create({
      data: {
        wallet,
        nonce,
        message,
        expiresAt,
      },
    });

    await logEvent({
      type: "identity.challenge_created",
      entityType: "identity",
      actor: `anon:${fingerprint}`,
      message: "Wallet link challenge created.",
      metadata: {
        wallet,
        challengeId: challenge.id,
        expiresAt,
      },
    });

    return json({
      challengeId: challenge.id,
      wallet: checksumWalletAddress(wallet),
      message,
      expiresAt: expiresAt.toISOString(),
      remaining: rateLimit.remaining,
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
