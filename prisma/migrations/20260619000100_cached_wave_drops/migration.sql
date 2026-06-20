CREATE TABLE "CachedWaveDrop" (
  "dropId" TEXT NOT NULL,
  "waveId" TEXT NOT NULL,
  "waveName" TEXT,
  "sourceRole" TEXT,
  "serialNo" INTEGER,
  "createdAt6529" TIMESTAMP(3),
  "updatedAt6529" TIMESTAMP(3),
  "authorHandle" TEXT,
  "authorDisplay" TEXT,
  "authorWallet" TEXT,
  "title" TEXT,
  "content" TEXT,
  "dropType" TEXT,
  "rawJson" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CachedWaveDrop_pkey" PRIMARY KEY ("dropId")
);

CREATE INDEX "CachedWaveDrop_waveId_createdAt6529_idx" ON "CachedWaveDrop"("waveId", "createdAt6529");
CREATE INDEX "CachedWaveDrop_waveId_serialNo_idx" ON "CachedWaveDrop"("waveId", "serialNo");
CREATE INDEX "CachedWaveDrop_authorHandle_createdAt6529_idx" ON "CachedWaveDrop"("authorHandle", "createdAt6529");
CREATE INDEX "CachedWaveDrop_authorWallet_createdAt6529_idx" ON "CachedWaveDrop"("authorWallet", "createdAt6529");
CREATE INDEX "CachedWaveDrop_createdAt6529_idx" ON "CachedWaveDrop"("createdAt6529");
CREATE INDEX "CachedWaveDrop_fetchedAt_idx" ON "CachedWaveDrop"("fetchedAt");
