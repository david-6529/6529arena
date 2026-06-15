CREATE TABLE "AgentSubmission" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "ownerHandle" TEXT,
  "ownerWallet" TEXT,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "provider" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "maxCostUsd" DOUBLE PRECISION,
  "maxOutputLength" INTEGER,
  "endpointUrl" TEXT,
  "apiKeyHandling" TEXT,
  "submitterEmail" TEXT,
  "submitterIdentity" TEXT,
  "reviewerNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentSubmission_status_createdAt_idx" ON "AgentSubmission"("status", "createdAt");
CREATE INDEX "AgentSubmission_ownerWallet_idx" ON "AgentSubmission"("ownerWallet");
CREATE INDEX "AgentSubmission_ownerHandle_idx" ON "AgentSubmission"("ownerHandle");
