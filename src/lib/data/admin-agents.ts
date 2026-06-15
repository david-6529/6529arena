import { getPrisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

type CreateAgentVersionInput = {
  agentId: string;
  provider: string;
  modelName: string;
  systemPrompt: string;
  maxCostUsd?: number | null;
  description?: string | null;
  activate?: boolean;
  actor?: string;
};

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export async function deactivateAgent(params: { agentId: string; actor?: string }) {
  const db = getPrisma();
  const agent = await db.agent.update({
    where: { id: params.agentId },
    data: {
      isActive: false,
      versions: {
        updateMany: {
          where: { isActive: true },
          data: { isActive: false },
        },
      },
    },
  }).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      throw Object.assign(new Error("Agent not found."), { status: 404 });
    }

    throw error;
  });

  await logEvent({
    type: "admin.agent_deactivated",
    severity: "warn",
    entityType: "agent",
    entityId: agent.id,
    actor: params.actor,
    message: "Admin deactivated an agent.",
    metadata: {
      slug: agent.slug,
      category: agent.category,
    },
  });

  return agent;
}

export async function createAgentVersion(input: CreateAgentVersionInput) {
  const db = getPrisma();
  const activate = input.activate ?? true;
  const result = await db.$transaction(async (tx) => {
    const agent = await tx.agent.findUnique({
      where: { id: input.agentId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!agent) {
      throw Object.assign(new Error("Agent not found."), { status: 404 });
    }

    const nextVersion = (agent.versions[0]?.version ?? 0) + 1;

    if (activate) {
      await tx.agentVersion.updateMany({
        where: { agentId: agent.id, isActive: true },
        data: { isActive: false },
      });
    }

    const version = await tx.agentVersion.create({
      data: {
        agentId: agent.id,
        version: nextVersion,
        provider: input.provider.trim(),
        modelName: input.modelName.trim(),
        systemPrompt: input.systemPrompt.trim(),
        maxCostUsd: input.maxCostUsd ?? null,
        description: cleanOptionalText(input.description),
        isActive: activate,
      },
    });

    const updatedAgent = await tx.agent.update({
      where: { id: agent.id },
      data: {
        provider: version.provider,
        modelName: version.modelName,
        systemPrompt: version.systemPrompt,
        maxCostUsd: version.maxCostUsd,
        description: version.description ?? agent.description,
        isActive: true,
      },
    });

    return { agent: updatedAgent, version };
  });

  await logEvent({
    type: "admin.agent_version_created",
    entityType: "agent",
    entityId: result.agent.id,
    actor: input.actor,
    message: "Admin created a new agent version.",
    metadata: {
      slug: result.agent.slug,
      category: result.agent.category,
      versionId: result.version.id,
      version: result.version.version,
      provider: result.version.provider,
      modelName: result.version.modelName,
      active: result.version.isActive,
    },
  });

  return result;
}
