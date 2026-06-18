import { Prisma } from "@/generated/prisma/client";
import { postDrop, createPollDrop } from "@/lib/6529/client";
import type { WaveDrop } from "@/lib/6529/types";
import { fetchWaveContext } from "@/lib/6529/wave-context";
import { runAgent } from "@/lib/agents/runAgent";
import { selectBattleAgents } from "@/lib/agents/selectAgents";
import { calculateFinalScore } from "@/lib/agents/scoreOutput";
import { renderBattlePost } from "@/lib/agents/render";
import { getPrisma } from "@/lib/db/prisma";
import { toAgentConfig } from "@/lib/data/queries";
import { logEvent } from "@/lib/observability/events";

type SnapshotPayload = {
  wave?: unknown;
  drops?: WaveDrop[];
};

type ScorableBattleEntry = {
  id: string;
  label: string;
  autoScore?: number | null;
  costUsd?: number | null;
  latencyMs?: number | null;
};

type ScorableVote = {
  selectedEntryId?: string | null;
  selectedLabel: string;
  weight: number;
};

function getSnapshotDrops(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload as WaveDrop[];
  }

  if (payload && typeof payload === "object" && "drops" in payload) {
    const drops = (payload as SnapshotPayload).drops;
    return Array.isArray(drops) ? drops : [];
  }

  return [];
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function maxBattleEstimatedCostUsd() {
  const configured = Number(process.env.MAX_BATTLE_ESTIMATED_COST_USD ?? 1);

  return Number.isFinite(configured) && configured > 0 ? configured : undefined;
}

export function scoreClosedBattleEntries(entries: ScorableBattleEntry[], votes: ScorableVote[]) {
  const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0);
  const scored = entries.map((entry) => {
    const votesFor = votes
      .filter((vote) => vote.selectedEntryId === entry.id || vote.selectedLabel === entry.label)
      .reduce((sum, vote) => sum + vote.weight, 0);
    const finalScore = calculateFinalScore({
      autoScore: entry.autoScore,
      votesFor,
      totalVotes: totalWeight,
      costUsd: entry.costUsd,
      latencyMs: entry.latencyMs,
    });

    return {
      entry,
      votesFor,
      humanScore: totalWeight ? votesFor / totalWeight : 0.5,
      finalScore,
    };
  });
  const winner = [...scored].sort((a, b) => b.finalScore - a.finalScore || b.votesFor - a.votesFor)[0];

  return {
    totalWeight,
    scored,
    winner,
  };
}

export async function createBattleFromWave(params: {
  waveId: string;
  triggerDropId?: string;
  idempotencyKey?: string;
  requestText: string;
  category: string;
  source?: string;
  battleType?: string;
  isOfficial?: boolean;
  limit?: number;
  contextFrom?: string;
  contextTo?: string;
  maxMessages?: number;
}) {
  const db = getPrisma();

  if (params.idempotencyKey) {
    const existingBattle = await db.battle.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      include: {
        snapshots: true,
        entries: {
          orderBy: { label: "asc" },
          include: { agent: true },
        },
      },
    });

    if (existingBattle) {
      await logEvent({
        type: "battle.idempotent_reuse",
        battleId: existingBattle.id,
        entityType: "battle",
        entityId: existingBattle.id,
        message: "Reused existing battle for idempotency key.",
        metadata: { idempotencyKey: params.idempotencyKey },
      });
      return existingBattle;
    }
  }

  const waveDrops = await fetchWaveContext({
    waveId: params.waveId,
    contextFrom: params.contextFrom,
    contextTo: params.contextTo,
    maxMessages: params.maxMessages ?? params.limit,
  });
  const drops = waveDrops.drops;

  if (!drops.length) {
    throw Object.assign(new Error("No 6529 drops found for the selected wave context."), {
      status: 422,
    });
  }

  const ordered = [...drops].sort((a, b) => (a.serial_no ?? 0) - (b.serial_no ?? 0));

  const battle = await db.battle.create({
    data: {
      waveId: params.waveId,
      triggerDropId: params.triggerDropId,
      idempotencyKey: params.idempotencyKey,
      requestText: params.requestText,
      category: params.category,
      source: params.source ?? "manual",
      battleType: params.battleType ?? "official",
      isOfficial: params.isOfficial ?? params.battleType !== "test",
      status: "pending",
      votingMethod: "external",
      snapshots: {
        create: {
          waveId: params.waveId,
          fromDropId: ordered[0]?.id,
          toDropId: ordered.at(-1)?.id,
          dropsJson: toInputJson({
            wave: waveDrops.wave ?? null,
            drops,
            context: waveDrops.context,
          }),
        },
      },
    },
    include: {
      snapshots: true,
    },
  });

  await logEvent({
    type: "battle.created",
    battleId: battle.id,
    entityType: "battle",
    entityId: battle.id,
    message: "Battle created from 6529 wave context.",
    metadata: {
      waveId: params.waveId,
      triggerDropId: params.triggerDropId,
      category: params.category,
      source: params.source ?? "manual",
      battleType: params.battleType ?? "official",
      dropCount: drops.length,
      context: waveDrops.context,
    },
  });

  return battle;
}

export async function runBattle(params: { battleId: string; agentIds?: string[] }) {
  const db = getPrisma();
  const battle = await db.battle.findUnique({
    where: { id: params.battleId },
    include: {
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      entries: true,
    },
  });

  if (!battle) {
    throw Object.assign(new Error("Battle not found."), { status: 404 });
  }

  if (battle.status === "closed") {
    throw Object.assign(new Error("Closed battles cannot be rerun."), { status: 409 });
  }

  const snapshot = battle.snapshots[0];
  const drops = getSnapshotDrops(snapshot?.dropsJson);

  if (!drops.length) {
    throw Object.assign(new Error("Battle has no wave snapshot drops to summarize."), { status: 422 });
  }

  const agents = await db.agent.findMany({
    where: { isActive: true, category: battle.category },
    include: {
      versions: {
        where: { isActive: true },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
  const selectedAgents = selectBattleAgents(agents.map(toAgentConfig), {
    category: battle.category,
    selectedAgentIds: params.agentIds,
  });

  if (selectedAgents.length < 2) {
    throw Object.assign(new Error("At least two active agents are required for this category."), {
      status: 422,
    });
  }

  const costCap = maxBattleEstimatedCostUsd();
  const missingCostAgents = selectedAgents.filter((agent) => typeof agent.maxCostUsd !== "number");
  const estimatedCostUsd = selectedAgents.reduce((sum, agent) => sum + (agent.maxCostUsd ?? 0), 0);

  if (costCap && missingCostAgents.length) {
    await logEvent({
      type: "battle.cost_cap_rejected",
      severity: "warn",
      battleId: battle.id,
      entityType: "battle",
      entityId: battle.id,
      message: "Battle run rejected because selected agents have no configured max cost.",
      metadata: {
        costCap,
        missingCostAgents: missingCostAgents.map((agent) => agent.id),
      },
    });
    throw Object.assign(new Error("Selected agents must have maxCostUsd configured before running."), {
      status: 422,
    });
  }

  if (costCap && estimatedCostUsd > costCap) {
    await logEvent({
      type: "battle.cost_cap_rejected",
      severity: "warn",
      battleId: battle.id,
      entityType: "battle",
      entityId: battle.id,
      message: "Battle run rejected by estimated cost cap.",
      metadata: {
        costCap,
        estimatedCostUsd,
        agents: selectedAgents.map((agent) => ({
          id: agent.id,
          maxCostUsd: agent.maxCostUsd,
        })),
      },
    });
    throw Object.assign(
      new Error(`Estimated battle cost $${estimatedCostUsd.toFixed(2)} exceeds cap $${costCap.toFixed(2)}.`),
      { status: 422 },
    );
  }

  await db.battle.update({
    where: { id: battle.id },
    data: { status: "running" },
  });
  await logEvent({
    type: "battle.run_started",
    battleId: battle.id,
    entityType: "battle",
    entityId: battle.id,
    message: "Battle run started.",
    metadata: { agentIds: params.agentIds, dropCount: drops.length, estimatedCostUsd, costCap },
  });
  await db.vote.deleteMany({ where: { battleId: battle.id } });
  await db.battleEntry.deleteMany({ where: { battleId: battle.id } });

  const labels = ["A", "B"];
  const input = {
    waveId: battle.waveId,
    requestText: battle.requestText,
    drops,
  };

  const settled = await Promise.allSettled(selectedAgents.map((agent) => runAgent(agent, input)));
  const successful = settled
    .map((result, index) => ({ result, agent: selectedAgents[index], label: labels[index] }))
    .filter((item) => item.result.status === "fulfilled");
  const failedMessages = settled.flatMap((result, index) => {
    if (result.status !== "rejected") {
      return [];
    }

    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    return [`${selectedAgents[index].name}: ${reason}`];
  });

  await Promise.all(
    settled.map(async (result, index) => {
      const agent = selectedAgents[index];

      if (result.status === "fulfilled") {
        await db.agentRun.create({
          data: {
            agentId: agent.id,
            agentVersionId: agent.versionId,
            battleId: battle.id,
            inputJson: toInputJson(input),
            output: result.value.rawOutput,
            status: "completed",
            runType: battle.isOfficial ? "official" : "test",
            provider: agent.provider,
            modelName: agent.modelName,
            promptTokens: result.value.promptTokens,
            completionTokens: result.value.completionTokens,
            costUsd: result.value.costUsd,
            latencyMs: result.value.latencyMs,
          },
        });
        return;
      }

      await db.agentRun.create({
        data: {
          agentId: agent.id,
          agentVersionId: agent.versionId,
          battleId: battle.id,
          inputJson: toInputJson(input),
          status: "failed",
          runType: battle.isOfficial ? "official" : "test",
          provider: agent.provider,
          modelName: agent.modelName,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        },
      });
    }),
  );

  if (successful.length < 2) {
    await db.battle.update({
      where: { id: battle.id },
      data: { status: "failed" },
    });
    await logEvent({
      type: "battle.run_failed",
      severity: "error",
      battleId: battle.id,
      entityType: "battle",
      entityId: battle.id,
      message: "Battle failed because fewer than two agents completed.",
      metadata: { failedMessages },
    });
    throw Object.assign(
      new Error(`Battle failed. ${failedMessages.join("; ")}`),
      { status: 502 },
    );
  }

  await Promise.all(
    successful.slice(0, 2).map(async (item) => {
      if (item.result.status !== "fulfilled") {
        return;
      }

      await db.battleEntry.create({
        data: {
          battleId: battle.id,
          agentId: item.agent.id,
          agentVersionId: item.agent.versionId,
          label: item.label,
          output: item.result.value.renderedOutput,
          citationsJson: toInputJson(item.result.value.structured.citations),
          costUsd: item.result.value.costUsd,
          latencyMs: item.result.value.latencyMs,
          autoScore: item.result.value.autoScore,
        },
      });
    }),
  );

  const updatedBattle = await db.battle.update({
    where: { id: battle.id },
    data: { status: "voting" },
    include: {
      entries: {
        orderBy: { label: "asc" },
        include: { agent: true },
      },
    },
  });

  await logEvent({
    type: "battle.run_completed",
    battleId: battle.id,
    entityType: "battle",
    entityId: battle.id,
    message: "Battle run completed and entries are ready for voting.",
    metadata: {
      entries: updatedBattle.entries.map((entry) => ({
        label: entry.label,
        agentId: entry.agentId,
        costUsd: entry.costUsd,
        latencyMs: entry.latencyMs,
      })),
    },
  });

  return updatedBattle;
}

export async function postBattleTo6529(params: {
  battleId: string;
  appUrl: string;
  createPoll?: boolean;
  pollClosingHours?: number;
}) {
  const db = getPrisma();
  const battle = await db.battle.findUnique({
    where: { id: params.battleId },
    include: {
      entries: {
        orderBy: { label: "asc" },
      },
    },
  });

  if (!battle) {
    throw Object.assign(new Error("Battle not found."), { status: 404 });
  }

  if (battle.postDropId) {
    await logEvent({
      type: "battle.post_idempotent_reuse",
      battleId: battle.id,
      entityType: "battle",
      entityId: battle.id,
      message: "Skipped 6529 post because battle was already posted.",
      metadata: { postDropId: battle.postDropId },
    });
    return db.battle.findUniqueOrThrow({
      where: { id: battle.id },
      include: {
        entries: {
          orderBy: { label: "asc" },
          include: { agent: true },
        },
      },
    });
  }

  const { content } = renderPostContent({
    battleId: battle.id,
    appUrl: params.appUrl,
    entries: battle.entries,
  });
  const pollClosingHours = params.pollClosingHours ?? 24;
  const post = params.createPoll
    ? await createPollDrop(
        battle.waveId,
        content,
        {
          options: ["Option A", "Option B"],
          multichoice: false,
          anonymous: false,
          closing_time: Date.now() + pollClosingHours * 60 * 60 * 1000,
        },
        { replyToDropId: battle.triggerDropId ?? undefined },
      )
    : await postDrop(battle.waveId, content, { replyToDropId: battle.triggerDropId ?? undefined });

  const updatedBattle = await db.battle.update({
    where: { id: battle.id },
    data: {
      status: "posted",
      votingMethod: params.createPoll ? "poll" : "external",
      postDropId: typeof post === "object" && post !== null && "id" in post ? String(post.id) : undefined,
    },
    include: {
      entries: {
        orderBy: { label: "asc" },
        include: { agent: true },
      },
    },
  });

  await logEvent({
    type: "battle.posted_to_6529",
    battleId: battle.id,
    entityType: "battle",
    entityId: battle.id,
    message: "Battle posted to 6529.",
    metadata: {
      waveId: battle.waveId,
      postDropId: updatedBattle.postDropId,
      votingMethod: updatedBattle.votingMethod,
      createPoll: params.createPoll,
    },
  });

  return updatedBattle;
}

export async function previewBattlePost(params: { battleId: string; appUrl: string }) {
  const db = getPrisma();
  const battle = await db.battle.findUnique({
    where: { id: params.battleId },
    include: {
      entries: {
        orderBy: { label: "asc" },
      },
    },
  });

  if (!battle) {
    throw Object.assign(new Error("Battle not found."), { status: 404 });
  }

  const rendered = renderPostContent({
    battleId: battle.id,
    appUrl: params.appUrl,
    entries: battle.entries,
  });

  return {
    battleId: battle.id,
    waveId: battle.waveId,
    triggerDropId: battle.triggerDropId,
    status: battle.status,
    postDropId: battle.postDropId,
    votingMethod: battle.votingMethod,
    ...rendered,
    contentLength: rendered.content.length,
  };
}

function renderPostContent(params: {
  battleId: string;
  appUrl: string;
  entries: Array<{ label: string; output: string }>;
}) {
  const optionA = params.entries.find((entry) => entry.label === "A") ?? params.entries[0];
  const optionB = params.entries.find((entry) => entry.label === "B") ?? params.entries[1];

  if (!optionA || !optionB) {
    throw Object.assign(new Error("Battle must have two generated entries before posting."), {
      status: 422,
    });
  }

  const battleUrl = new URL(`/battles/${params.battleId}`, params.appUrl).toString();

  return {
    battleUrl,
    content: renderBattlePost({
      battleUrl,
      optionA: optionA.output,
      optionB: optionB.output,
    }),
  };
}

export async function closeBattle(battleId: string) {
  const db = getPrisma();
  const battle = await db.battle.findUnique({
    where: { id: battleId },
    include: {
      entries: true,
      votes: true,
    },
  });

  if (!battle) {
    throw Object.assign(new Error("Battle not found."), { status: 404 });
  }

  if (!battle.entries.length) {
    throw Object.assign(new Error("Battle has no entries to score."), { status: 422 });
  }

  const { totalWeight, scored, winner } = scoreClosedBattleEntries(battle.entries, battle.votes);

  await Promise.all(
    scored.map((item) =>
      db.battleEntry.update({
        where: { id: item.entry.id },
        data: {
          humanScore: item.humanScore,
          finalScore: item.finalScore,
        },
      }),
    ),
  );

  const closedBattle = await db.battle.update({
    where: { id: battle.id },
    data: {
      status: "closed",
      winnerEntryId: winner.entry.id,
    },
    include: {
      entries: {
        orderBy: { label: "asc" },
        include: { agent: true, votes: true },
      },
      votes: true,
    },
  });

  await logEvent({
    type: "battle.closed",
    battleId: battle.id,
    entityType: "battle",
    entityId: battle.id,
    message: "Battle closed and winner calculated.",
    metadata: {
      winnerEntryId: winner.entry.id,
      totalVotes: totalWeight,
      scores: scored.map((item) => ({
        entryId: item.entry.id,
        label: item.entry.label,
        votesFor: item.votesFor,
        finalScore: item.finalScore,
      })),
    },
  });

  return closedBattle;
}
