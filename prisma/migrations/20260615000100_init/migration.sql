CREATE TABLE "Identity" (
  "id" TEXT NOT NULL,
  "wallet" TEXT NOT NULL,
  "handle" TEXT,
  "displayName" TEXT,
  "pfp" TEXT,
  "repScore" DOUBLE PRECISION,
  "source" TEXT NOT NULL DEFAULT 'wallet',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Agent" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "ownerIdentityId" TEXT,
  "ownerHandle" TEXT,
  "ownerWallet" TEXT,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "provider" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "maxCostUsd" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentVersion" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "maxCostUsd" DOUBLE PRECISION,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Battle" (
  "id" TEXT NOT NULL,
  "waveId" TEXT NOT NULL,
  "triggerDropId" TEXT,
  "idempotencyKey" TEXT,
  "requestText" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "battleType" TEXT NOT NULL DEFAULT 'official',
  "isOfficial" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "postDropId" TEXT,
  "votingMethod" TEXT,
  "winnerEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BattleEntry" (
  "id" TEXT NOT NULL,
  "battleId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "agentVersionId" TEXT,
  "label" TEXT NOT NULL,
  "output" TEXT NOT NULL,
  "citationsJson" JSONB,
  "costUsd" DOUBLE PRECISION,
  "latencyMs" INTEGER,
  "autoScore" DOUBLE PRECISION,
  "humanScore" DOUBLE PRECISION,
  "finalScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BattleEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BattleJob" (
  "id" TEXT NOT NULL,
  "battleId" TEXT NOT NULL,
  "dedupeKey" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "payloadJson" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BattleJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRun" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "agentVersionId" TEXT,
  "battleId" TEXT,
  "inputJson" JSONB NOT NULL,
  "output" TEXT,
  "status" TEXT NOT NULL,
  "runType" TEXT NOT NULL DEFAULT 'official',
  "provider" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "costUsd" DOUBLE PRECISION,
  "latencyMs" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vote" (
  "id" TEXT NOT NULL,
  "battleId" TEXT NOT NULL,
  "voterIdentityId" TEXT,
  "dedupeKey" TEXT,
  "voterHandle" TEXT,
  "voterWallet" TEXT,
  "selectedLabel" TEXT NOT NULL,
  "selectedEntryId" TEXT,
  "source" TEXT NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "WaveSnapshot" (
  "id" TEXT NOT NULL,
  "battleId" TEXT,
  "waveId" TEXT NOT NULL,
  "fromDropId" TEXT,
  "toDropId" TEXT,
  "dropsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaveSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Identity_wallet_key" ON "Identity"("wallet");
CREATE INDEX "Identity_handle_idx" ON "Identity"("handle");

CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");
CREATE INDEX "Agent_category_isActive_idx" ON "Agent"("category", "isActive");
CREATE INDEX "Agent_ownerIdentityId_idx" ON "Agent"("ownerIdentityId");

CREATE UNIQUE INDEX "AgentVersion_agentId_version_key" ON "AgentVersion"("agentId", "version");
CREATE INDEX "AgentVersion_agentId_isActive_idx" ON "AgentVersion"("agentId", "isActive");

CREATE UNIQUE INDEX "Battle_idempotencyKey_key" ON "Battle"("idempotencyKey");
CREATE INDEX "Battle_category_status_idx" ON "Battle"("category", "status");
CREATE INDEX "Battle_waveId_idx" ON "Battle"("waveId");
CREATE INDEX "Battle_isOfficial_category_idx" ON "Battle"("isOfficial", "category");

CREATE UNIQUE INDEX "BattleEntry_battleId_label_key" ON "BattleEntry"("battleId", "label");
CREATE UNIQUE INDEX "BattleEntry_battleId_agentId_key" ON "BattleEntry"("battleId", "agentId");
CREATE INDEX "BattleEntry_agentId_idx" ON "BattleEntry"("agentId");
CREATE INDEX "BattleEntry_agentVersionId_idx" ON "BattleEntry"("agentVersionId");

CREATE UNIQUE INDEX "BattleJob_dedupeKey_key" ON "BattleJob"("dedupeKey");
CREATE INDEX "BattleJob_status_runAfter_idx" ON "BattleJob"("status", "runAfter");
CREATE INDEX "BattleJob_battleId_idx" ON "BattleJob"("battleId");

CREATE INDEX "AgentRun_agentId_status_idx" ON "AgentRun"("agentId", "status");
CREATE INDEX "AgentRun_agentVersionId_idx" ON "AgentRun"("agentVersionId");
CREATE INDEX "AgentRun_battleId_idx" ON "AgentRun"("battleId");

CREATE INDEX "Vote_battleId_idx" ON "Vote"("battleId");
CREATE INDEX "Vote_voterIdentityId_idx" ON "Vote"("voterIdentityId");
CREATE INDEX "Vote_selectedEntryId_idx" ON "Vote"("selectedEntryId");
CREATE UNIQUE INDEX "Vote_dedupeKey_key" ON "Vote"("dedupeKey");

CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

CREATE INDEX "WaveSnapshot_battleId_idx" ON "WaveSnapshot"("battleId");
CREATE INDEX "WaveSnapshot_waveId_idx" ON "WaveSnapshot"("waveId");

ALTER TABLE "Agent" ADD CONSTRAINT "Agent_ownerIdentityId_fkey"
  FOREIGN KEY ("ownerIdentityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentVersion" ADD CONSTRAINT "AgentVersion_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BattleEntry" ADD CONSTRAINT "BattleEntry_battleId_fkey"
  FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BattleEntry" ADD CONSTRAINT "BattleEntry_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BattleEntry" ADD CONSTRAINT "BattleEntry_agentVersionId_fkey"
  FOREIGN KEY ("agentVersionId") REFERENCES "AgentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BattleJob" ADD CONSTRAINT "BattleJob_battleId_fkey"
  FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentVersionId_fkey"
  FOREIGN KEY ("agentVersionId") REFERENCES "AgentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_battleId_fkey"
  FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Vote" ADD CONSTRAINT "Vote_battleId_fkey"
  FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterIdentityId_fkey"
  FOREIGN KEY ("voterIdentityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Vote" ADD CONSTRAINT "Vote_selectedEntryId_fkey"
  FOREIGN KEY ("selectedEntryId") REFERENCES "BattleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaveSnapshot" ADD CONSTRAINT "WaveSnapshot_battleId_fkey"
  FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
