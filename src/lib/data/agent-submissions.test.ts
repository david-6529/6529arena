import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveAgentSubmission } from "@/lib/data/agent-submissions";
import { getPrisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@/lib/observability/events", () => ({
  logEvent: vi.fn(),
}));

const tx = {
  agentSubmission: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  agent: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  agentVersion: {
    create: vi.fn(),
  },
  identity: {
    upsert: vi.fn(),
  },
};

const db = {
  $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
};

const baseSubmission = {
  id: "submission-1",
  status: "pending",
  approvedAgent: null,
  endpointUrl: null,
  maxCostUsd: 0.1,
  category: "Wave Summarization",
  slug: null,
  name: "Submitted Summarizer",
  ownerWallet: null,
  ownerHandle: "builder",
  description: "Useful test agent",
  provider: "openai",
  modelName: "gpt-4.1-mini",
  systemPrompt: "Summarize safely and cite sources.",
};

beforeEach(() => {
  vi.mocked(getPrisma).mockReturnValue(db as never);
  db.$transaction.mockClear();
  Object.values(tx).forEach((model) => {
    Object.values(model).forEach((fn) => fn.mockReset());
  });
});

describe("approveAgentSubmission", () => {
  it("blocks endpoint submissions until endpoint execution is sandboxed", async () => {
    tx.agentSubmission.findUnique.mockResolvedValue({
      ...baseSubmission,
      endpointUrl: "https://agent.example/run",
    });

    await expect(approveAgentSubmission({ submissionId: "submission-1" })).rejects.toMatchObject({
      status: 422,
    });
    expect(tx.agent.create).not.toHaveBeenCalled();
    expect(tx.agentVersion.create).not.toHaveBeenCalled();
  });

  it("requires an explicit max cost before approval", async () => {
    tx.agentSubmission.findUnique.mockResolvedValue({
      ...baseSubmission,
      maxCostUsd: null,
    });

    await expect(approveAgentSubmission({ submissionId: "submission-1" })).rejects.toThrow(
      "Submission must include maxCostUsd before approval.",
    );
    expect(tx.agent.create).not.toHaveBeenCalled();
  });

  it("reuses already approved submissions", async () => {
    const approvedAgent = {
      id: "agent-1",
      slug: "submitted-summarizer",
      category: "Wave Summarization",
      provider: "openai",
      isActive: true,
    };
    tx.agentSubmission.findUnique.mockResolvedValue({
      ...baseSubmission,
      status: "approved",
      approvedAgent,
    });

    await expect(approveAgentSubmission({ submissionId: "submission-1" })).resolves.toMatchObject({
      agent: approvedAgent,
      reused: true,
    });
    expect(tx.agent.create).not.toHaveBeenCalled();
  });
});
