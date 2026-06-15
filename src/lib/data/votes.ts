import { getPrisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

export type RecordVoteParams = {
  battleId: string;
  selectedLabel: "A" | "B" | "C";
  source: string;
  voterHandle?: string;
  voterWallet?: string;
  voterIdentityId?: string;
  externalId?: string;
  dedupeKey?: string;
  weight?: number;
  allowClosed?: boolean;
  actor?: string;
  metadata?: unknown;
};

export function normalizeVoterKey(params: Pick<RecordVoteParams, "voterWallet" | "voterHandle" | "externalId">) {
  if (params.voterWallet) {
    return `wallet:${params.voterWallet.toLowerCase()}`;
  }

  if (params.voterHandle) {
    return `handle:${params.voterHandle.toLowerCase()}`;
  }

  if (params.externalId) {
    return `external:${params.externalId}`;
  }

  return undefined;
}

export function buildVoteDedupeKey(params: Pick<RecordVoteParams, "battleId" | "source" | "voterWallet" | "voterHandle" | "externalId" | "dedupeKey">) {
  if (params.dedupeKey) {
    return params.dedupeKey;
  }

  const voterKey = normalizeVoterKey(params);

  return voterKey ? `${params.battleId}:${params.source}:${voterKey}` : undefined;
}

export async function recordVote(params: RecordVoteParams) {
  const db = getPrisma();
  const battle = await db.battle.findUnique({
    where: { id: params.battleId },
    include: {
      entries: true,
    },
  });

  if (!battle) {
    throw Object.assign(new Error("Battle not found."), { status: 404 });
  }

  if (battle.status === "closed" && !params.allowClosed) {
    throw Object.assign(new Error("Battle is already closed."), { status: 409 });
  }

  const entry = battle.entries.find((item) => item.label === params.selectedLabel);

  if (!entry) {
    throw Object.assign(new Error("Selected option is not part of this battle."), { status: 422 });
  }

  const dedupeKey = buildVoteDedupeKey(params);
  const previousVote = dedupeKey
    ? await db.vote.findUnique({
        where: { dedupeKey },
        select: {
          id: true,
          selectedLabel: true,
        },
      })
    : null;
  const data = {
    battleId: battle.id,
    dedupeKey,
    selectedLabel: params.selectedLabel,
    selectedEntryId: entry.id,
    voterIdentityId: params.voterIdentityId,
    voterHandle: params.voterHandle,
    voterWallet: params.voterWallet,
    source: params.source,
    weight: params.weight ?? 1,
  };
  const vote = dedupeKey
    ? await db.vote.upsert({
        where: { dedupeKey },
        update: data,
        create: data,
      })
    : await db.vote.create({ data });

  await logEvent({
    type: previousVote ? "vote.updated" : "vote.created",
    battleId: battle.id,
    entityType: "vote",
    entityId: vote.id,
    actor: params.actor ?? normalizeVoterKey(params),
    message: previousVote ? "Vote updated." : "Vote recorded.",
    metadata: {
      selectedLabel: params.selectedLabel,
      previousLabel: previousVote?.selectedLabel,
      source: params.source,
      externalId: params.externalId,
      ...((params.metadata && typeof params.metadata === "object") ? params.metadata : {}),
    },
  });

  return {
    vote,
    previousVote,
  };
}
