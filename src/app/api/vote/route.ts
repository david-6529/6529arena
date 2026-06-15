import { z } from "zod";
import { getRequestFingerprint, handleRouteError, json, parseJson } from "@/lib/api";
import { getPrisma } from "@/lib/db/prisma";
import { getIdentityWalletFromCookie } from "@/lib/identity-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recordVote } from "@/lib/data/votes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const voteSchema = z.object({
  battleId: z.string().min(1),
  selectedLabel: z.enum(["A", "B", "C"]),
  source: z.literal("external_site").default("external_site"),
});

type LinkedVoter = {
  voterIdentityId?: string;
  voterHandle?: string;
  voterWallet?: string;
};

async function getLinkedVoter(request: Request): Promise<LinkedVoter> {
  const wallet = getIdentityWalletFromCookie(request.headers.get("cookie"));

  if (!wallet) {
    return {};
  }

  const identity = await getPrisma().identity.findUnique({
    where: { wallet },
    select: {
      id: true,
      handle: true,
    },
  });

  return {
    voterIdentityId: identity?.id,
    voterHandle: identity?.handle ?? undefined,
    voterWallet: wallet,
  };
}

function normalizeVoterKey(voter: LinkedVoter, fingerprint: string) {
  if (voter.voterWallet) {
    return `wallet:${voter.voterWallet.toLowerCase()}`;
  }

  return `anon:${fingerprint}`;
}

function voteLimit() {
  const configured = Number(process.env.VOTE_RATE_LIMIT_PER_HOUR ?? 30);

  return Number.isFinite(configured) && configured > 0 ? configured : 30;
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, voteSchema);
    const fingerprint = getRequestFingerprint(request);
    const linkedVoter = await getLinkedVoter(request);
    const voterKey = normalizeVoterKey(linkedVoter, fingerprint);
    const rateLimit = await consumeRateLimit({
      scope: "vote",
      identifier: voterKey,
      limit: voteLimit(),
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return json(
        { error: "Vote rate limit exceeded.", resetAt: rateLimit.resetAt.toISOString() },
        {
          status: 429,
          headers: {
            "x-ratelimit-remaining": String(rateLimit.remaining),
            "x-ratelimit-reset": rateLimit.resetAt.toISOString(),
          },
        },
      );
    }

    const { vote } = await recordVote({
      ...body,
      ...linkedVoter,
      actor: voterKey,
      dedupeKey: `${body.battleId}:${body.source}:${voterKey}`,
      metadata: {
        rateLimitRemaining: rateLimit.remaining,
      },
    });

    return json(
      { vote },
      {
        status: 201,
        headers: {
          "x-ratelimit-remaining": String(rateLimit.remaining),
          "x-ratelimit-reset": rateLimit.resetAt.toISOString(),
        },
      },
    );
  } catch (error) {
    return handleRouteError(error, request);
  }
}
