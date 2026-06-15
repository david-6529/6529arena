ALTER TABLE "AgentSubmission"
  ADD COLUMN "approvedAgentId" TEXT,
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "AgentSubmission_approvedAgentId_key" ON "AgentSubmission"("approvedAgentId");
CREATE INDEX "AgentSubmission_approvedAgentId_idx" ON "AgentSubmission"("approvedAgentId");

ALTER TABLE "AgentSubmission"
  ADD CONSTRAINT "AgentSubmission_approvedAgentId_fkey"
  FOREIGN KEY ("approvedAgentId") REFERENCES "Agent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
