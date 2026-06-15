import { z } from "zod";
import {
  checksumWalletAddress,
  normalizeWalletAddress,
  serializeIdentitySessionCookie,
  verifyIdentitySignature,
} from "@/lib/identity-auth";
import { getRequestFingerprint, handleRouteError, json, parseJson } from "@/lib/api";
import { getPrisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const linkSchema = z.object({
  wallet: z.string().min(1),
  challengeId: z.string().min(1),
  signature: z.string().min(1),
  handle: z.string().trim().max(80).optional(),
});

function cleanHandle(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, linkSchema);
    const wallet = normalizeWalletAddress(body.wallet);
    const db = getPrisma();
    const challenge = await db.identityChallenge.findFirst({
      where: {
        id: body.challengeId,
        wallet,
        status: "pending",
      },
    });

    if (!challenge) {
      throw Object.assign(new Error("Wallet challenge not found or already used."), { status: 404 });
    }

    if (challenge.expiresAt <= new Date()) {
      await db.identityChallenge.update({
        where: { id: challenge.id },
        data: { status: "expired" },
      });
      throw Object.assign(new Error("Wallet challenge expired."), { status: 410 });
    }

    if (!verifyIdentitySignature({ wallet, message: challenge.message, signature: body.signature })) {
      throw Object.assign(new Error("Wallet signature did not match the requested address."), { status: 401 });
    }

    const handle = cleanHandle(body.handle);
    const identity = await db.$transaction(async (tx) => {
      await tx.identityChallenge.update({
        where: { id: challenge.id },
        data: {
          status: "used",
          usedAt: new Date(),
        },
      });

      return tx.identity.upsert({
        where: { wallet },
        update: {
          handle,
          displayName: handle,
          source: "wallet_signature",
        },
        create: {
          wallet,
          handle,
          displayName: handle,
          source: "wallet_signature",
        },
      });
    });

    await logEvent({
      type: "identity.wallet_linked",
      entityType: "identity",
      entityId: identity.id,
      actor: getRequestFingerprint(request),
      message: "Wallet linked to an Agent Arena identity.",
      metadata: {
        wallet,
        handle,
        challengeId: challenge.id,
      },
    });

    return json(
      {
        identity: {
          id: identity.id,
          wallet: checksumWalletAddress(identity.wallet),
          handle: identity.handle,
          displayName: identity.displayName,
          source: identity.source,
        },
      },
      {
        headers: {
          "set-cookie": serializeIdentitySessionCookie(wallet),
        },
      },
    );
  } catch (error) {
    return handleRouteError(error, request);
  }
}
