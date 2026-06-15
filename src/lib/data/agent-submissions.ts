import { Prisma } from "@/generated/prisma/client";
import { arenaCategories } from "@/lib/agents/internal-agents";
import { getPrisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/observability/events";

type ReviewInput = {
  submissionId: string;
  reviewerNotes?: string;
  reviewedBy?: string;
};

type ApproveInput = ReviewInput & {
  activate?: boolean;
};

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed || undefined;
}

function slugify(value: string) {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "agent";
}

async function uniqueAgentSlug(tx: Prisma.TransactionClient, requestedSlug: string) {
  const base = slugify(requestedSlug);

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const existing = await tx.agent.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw Object.assign(new Error("Could not allocate a unique agent slug."), { status: 409 });
}

function assertSubmissionCanBecomePromptAgent(submission: {
  endpointUrl: string | null;
  maxCostUsd: number | null;
  category: string;
}) {
  if (submission.endpointUrl) {
    throw Object.assign(
      new Error("External endpoint submissions cannot be promoted until endpoint execution is sandboxed."),
      { status: 422 },
    );
  }

  if (!arenaCategories.includes(submission.category)) {
    throw Object.assign(new Error("Submission category is not supported by the arena."), { status: 422 });
  }

  if (typeof submission.maxCostUsd !== "number" || submission.maxCostUsd <= 0) {
    throw Object.assign(new Error("Submission must include maxCostUsd before approval."), { status: 422 });
  }
}

export async function approveAgentSubmission(input: ApproveInput) {
  const db = getPrisma();
  const result = await db.$transaction(async (tx) => {
    const submission = await tx.agentSubmission.findUnique({
      where: { id: input.submissionId },
      include: { approvedAgent: true },
    });

    if (!submission) {
      throw Object.assign(new Error("Agent submission not found."), { status: 404 });
    }

    if (submission.status === "approved" && submission.approvedAgent) {
      return {
        submission,
        agent: submission.approvedAgent,
        reused: true,
      };
    }

    assertSubmissionCanBecomePromptAgent(submission);

    const slug = await uniqueAgentSlug(tx, submission.slug ?? submission.name);
    const ownerWallet = cleanOptionalText(submission.ownerWallet)?.toLowerCase();
    const ownerHandle = cleanOptionalText(submission.ownerHandle);
    const ownerIdentity = ownerWallet
      ? await tx.identity.upsert({
          where: { wallet: ownerWallet },
          update: ownerHandle ? { handle: ownerHandle } : {},
          create: {
            wallet: ownerWallet,
            handle: ownerHandle,
            source: "submission",
          },
        })
      : undefined;

    const agent = await tx.agent.create({
      data: {
        name: submission.name.trim(),
        slug,
        ownerIdentityId: ownerIdentity?.id,
        ownerHandle,
        ownerWallet,
        category: submission.category,
        description: cleanOptionalText(submission.description),
        provider: submission.provider,
        modelName: submission.modelName,
        systemPrompt: submission.systemPrompt,
        isPublic: true,
        isActive: input.activate ?? true,
        maxCostUsd: submission.maxCostUsd,
      },
    });

    await tx.agentVersion.create({
      data: {
        agentId: agent.id,
        version: 1,
        provider: submission.provider,
        modelName: submission.modelName,
        systemPrompt: submission.systemPrompt,
        maxCostUsd: submission.maxCostUsd,
        description: cleanOptionalText(submission.description),
        isActive: true,
      },
    });

    const reviewedSubmission = await tx.agentSubmission.update({
      where: { id: submission.id },
      data: {
        status: "approved",
        slug,
        approvedAgentId: agent.id,
        reviewerNotes: cleanOptionalText(input.reviewerNotes),
        reviewedBy: cleanOptionalText(input.reviewedBy),
        reviewedAt: new Date(),
      },
      include: { approvedAgent: true },
    });

    return {
      submission: reviewedSubmission,
      agent,
      reused: false,
    };
  });

  await logEvent({
    type: result.reused ? "agent_submission.approval_reused" : "agent_submission.approved",
    entityType: "agent_submission",
    entityId: result.submission.id,
    actor: cleanOptionalText(input.reviewedBy),
    message: result.reused
      ? "Approved submission already had a live agent."
      : "Agent submission promoted into an active prompt-config agent.",
    metadata: {
      agentId: result.agent.id,
      slug: result.agent.slug,
      category: result.agent.category,
      provider: result.agent.provider,
      active: result.agent.isActive,
    },
  });

  return result;
}

export async function rejectAgentSubmission(input: ReviewInput) {
  const db = getPrisma();
  const submission = await db.agentSubmission.findUnique({
    where: { id: input.submissionId },
    include: { approvedAgent: true },
  });

  if (!submission) {
    throw Object.assign(new Error("Agent submission not found."), { status: 404 });
  }

  if (submission.approvedAgentId) {
    throw Object.assign(
      new Error("Approved submissions cannot be rejected while they are linked to a live agent."),
      { status: 409 },
    );
  }

  const reviewedSubmission = await db.agentSubmission.update({
    where: { id: submission.id },
    data: {
      status: "rejected",
      reviewerNotes: cleanOptionalText(input.reviewerNotes),
      reviewedBy: cleanOptionalText(input.reviewedBy),
      reviewedAt: new Date(),
    },
  });

  await logEvent({
    type: "agent_submission.rejected",
    severity: "warn",
    entityType: "agent_submission",
    entityId: reviewedSubmission.id,
    actor: cleanOptionalText(input.reviewedBy),
    message: "Agent submission rejected during admin review.",
    metadata: {
      category: reviewedSubmission.category,
      provider: reviewedSubmission.provider,
    },
  });

  return reviewedSubmission;
}
