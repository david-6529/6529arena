CREATE TABLE "WaveBrief" (
  "id" TEXT NOT NULL,
  "waveId" TEXT NOT NULL,
  "triggerDropId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "title" TEXT NOT NULL,
  "requestText" TEXT NOT NULL,
  "contextJson" JSONB,
  "dropsJson" JSONB NOT NULL,
  "briefJson" JSONB NOT NULL,
  "content" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "costUsd" DOUBLE PRECISION,
  "latencyMs" INTEGER,
  "reviewerNotes" TEXT,
  "reviewedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "postDropId" TEXT,
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaveBrief_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WaveBrief_waveId_createdAt_idx" ON "WaveBrief"("waveId", "createdAt");
CREATE INDEX "WaveBrief_status_createdAt_idx" ON "WaveBrief"("status", "createdAt");
