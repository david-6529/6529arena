import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { internalAgents } from "../src/lib/agents/internal-agents";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  const savedAgents = new Map<string, Awaited<ReturnType<typeof prisma.agent.upsert>>>();

  for (const agent of internalAgents) {
    const savedAgent = await prisma.agent.upsert({
      where: { slug: agent.slug },
      update: {
        ...agent,
        isActive: true,
        isPublic: false,
      },
      create: {
        ...agent,
        isActive: true,
        isPublic: false,
      },
    });
    savedAgents.set(agent.slug, savedAgent);

    await prisma.agentVersion.upsert({
      where: {
        agentId_version: {
          agentId: savedAgent.id,
          version: 1,
        },
      },
      update: {
        provider: agent.provider,
        modelName: agent.modelName,
        systemPrompt: agent.systemPrompt,
        maxCostUsd: agent.maxCostUsd,
        description: agent.description,
        isActive: true,
      },
      create: {
        agentId: savedAgent.id,
        version: 1,
        provider: agent.provider,
        modelName: agent.modelName,
        systemPrompt: agent.systemPrompt,
        maxCostUsd: agent.maxCostUsd,
        description: agent.description,
        isActive: true,
      },
    });
  }

  if (process.env.SEED_DEMO_DATA === "true") {
    await seedDemoBattles(savedAgents);
  }
}

async function activeVersionId(agentId: string) {
  const version = await prisma.agentVersion.findFirst({
    where: { agentId, isActive: true },
    orderBy: { version: "desc" },
    select: { id: true },
  });

  return version?.id;
}

async function seedDemoBattles(agents: Map<string, Awaited<ReturnType<typeof prisma.agent.upsert>>>) {
  const demoKeys = ["demo-wave-summary-001", "demo-wave-summary-002", "demo-wave-summary-003"];
  const existing = await prisma.battle.findMany({
    where: { idempotencyKey: { in: demoKeys } },
    select: { id: true },
  });
  const existingIds = existing.map((battle) => battle.id);

  if (existingIds.length) {
    await prisma.vote.deleteMany({ where: { battleId: { in: existingIds } } });
    await prisma.agentRun.deleteMany({ where: { battleId: { in: existingIds } } });
    await prisma.battleEntry.deleteMany({ where: { battleId: { in: existingIds } } });
    await prisma.waveSnapshot.deleteMany({ where: { battleId: { in: existingIds } } });
    await prisma.battleJob.deleteMany({ where: { battleId: { in: existingIds } } });
    await prisma.battle.deleteMany({ where: { id: { in: existingIds } } });
  }

  const demoBattles = [
    {
      key: "demo-wave-summary-001",
      requestText: "@AgentArena summarize the last 24 hours of this wave",
      waveId: "demo-wave-alpha",
      agents: ["onboarding-friendly-summarizer", "concise-summarizer"],
      scores: [0.81, 0.78],
      costs: [0.026, 0.018],
      latencies: [4600, 3900],
      votes: [9, 7],
      winner: "A",
    },
    {
      key: "demo-wave-summary-002",
      requestText: "@AgentArena create a decision brief from this wave",
      waveId: "demo-wave-beta",
      agents: ["source-heavy-summarizer", "decision-brief-summarizer"],
      scores: [0.9, 0.86],
      costs: [0.138, 0.074],
      latencies: [9800, 7100],
      votes: [11, 8],
      winner: "A",
    },
    {
      key: "demo-wave-summary-003",
      requestText: "@AgentArena summarize risks and objections in this wave",
      waveId: "demo-wave-gamma",
      agents: ["risk-objection-summarizer", "source-heavy-summarizer"],
      scores: [0.87, 0.84],
      costs: [0.24, 0.142],
      latencies: [12400, 10100],
      votes: [10, 9],
      winner: "A",
    },
  ];

  for (const demo of demoBattles) {
    const battle = await prisma.battle.create({
      data: {
        waveId: demo.waveId,
        triggerDropId: `${demo.waveId}-trigger`,
        idempotencyKey: demo.key,
        requestText: demo.requestText,
        category: "Wave Summarization",
        source: "demo_seed",
        battleType: "official",
        isOfficial: true,
        status: "closed",
        votingMethod: "demo",
        postDropId: `${demo.waveId}-post`,
      },
    });
    const entries = [];

    for (const [index, slug] of demo.agents.entries()) {
      const agent = agents.get(slug);

      if (!agent) {
        continue;
      }

      const label = index === 0 ? "A" : "B";
      const versionId = await activeVersionId(agent.id);
      const entry = await prisma.battleEntry.create({
        data: {
          battleId: battle.id,
          agentId: agent.id,
          agentVersionId: versionId,
          label,
          output: `**Demo ${label}: ${agent.name}**\n\n- Summarized the main wave themes.\n- Preserved open questions and decision points.\n- Cited representative drops from the demo fixture.\n\nConfidence: ${Math.round(demo.scores[index] * 100)}%`,
          citationsJson: [
            { drop_id: `${demo.waveId}-001`, reason: "Representative kickoff message." },
            { drop_id: `${demo.waveId}-002`, reason: "Captured the cost or risk discussion." },
          ],
          costUsd: demo.costs[index],
          latencyMs: demo.latencies[index],
          autoScore: demo.scores[index],
          humanScore: demo.votes[index] / Math.max(...demo.votes),
          finalScore: demo.scores[index],
        },
      });
      entries.push(entry);

      await prisma.agentRun.create({
        data: {
          agentId: agent.id,
          agentVersionId: versionId,
          battleId: battle.id,
          inputJson: {
            waveId: demo.waveId,
            requestText: demo.requestText,
            drops: [`${demo.waveId}-001`, `${demo.waveId}-002`],
          },
          output: entry.output,
          status: "completed",
          runType: "official",
          provider: agent.provider,
          modelName: agent.modelName,
          promptTokens: 3200 + index * 200,
          completionTokens: 650 + index * 80,
          costUsd: demo.costs[index],
          latencyMs: demo.latencies[index],
        },
      });
    }

    const winningEntry = entries.find((entry) => entry.label === demo.winner);

    await prisma.battle.update({
      where: { id: battle.id },
      data: { winnerEntryId: winningEntry?.id },
    });

    for (const [index, entry] of entries.entries()) {
      for (let voteIndex = 0; voteIndex < demo.votes[index]; voteIndex += 1) {
        await prisma.vote.create({
          data: {
            battleId: battle.id,
            dedupeKey: `${demo.key}:${entry.label}:${voteIndex + 1}`,
            voterHandle: `demo-voter-${voteIndex + 1}`,
            selectedLabel: entry.label,
            selectedEntryId: entry.id,
            source: "demo_seed",
            weight: 1,
          },
        });
      }
    }

    await prisma.waveSnapshot.create({
      data: {
        battleId: battle.id,
        waveId: demo.waveId,
        fromDropId: `${demo.waveId}-001`,
        toDropId: `${demo.waveId}-005`,
        dropsJson: {
          drops: [
            {
              id: `${demo.waveId}-001`,
              serial_no: 1,
              content: "Demo wave kickoff and context.",
              author: { handle: "demo-builder" },
            },
            {
              id: `${demo.waveId}-002`,
              serial_no: 2,
              content: "Demo scoring, cost, latency, and risk discussion.",
              author: { handle: "demo-reviewer" },
            },
          ],
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
