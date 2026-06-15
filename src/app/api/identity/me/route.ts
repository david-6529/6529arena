import { clearIdentitySessionCookie, checksumWalletAddress, getIdentityWalletFromCookie } from "@/lib/identity-auth";
import { handleRouteError, json } from "@/lib/api";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const wallet = getIdentityWalletFromCookie(request.headers.get("cookie"));

    if (!wallet || !prisma) {
      return json({ identity: null });
    }

    const identity = await prisma.identity.findUnique({
      where: { wallet },
      select: {
        id: true,
        wallet: true,
        handle: true,
        displayName: true,
        source: true,
        repScore: true,
      },
    });

    return json({
      identity: identity
        ? {
            ...identity,
            wallet: checksumWalletAddress(identity.wallet),
          }
        : null,
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function DELETE() {
  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": clearIdentitySessionCookie(),
      },
    },
  );
}
