CREATE TABLE "WaveTask" (
  "id" TEXT NOT NULL,
  "waveBriefId" TEXT,
  "waveId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'suggested',
  "suggestedOwner" TEXT,
  "sourceDropIdsJson" JSONB,
  "reviewerNotes" TEXT,
  "reviewedBy" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaveTask_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WaveTask"
  ADD CONSTRAINT "WaveTask_waveBriefId_fkey"
  FOREIGN KEY ("waveBriefId") REFERENCES "WaveBrief"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WaveTask_waveId_status_idx" ON "WaveTask"("waveId", "status");
CREATE INDEX "WaveTask_waveBriefId_idx" ON "WaveTask"("waveBriefId");
CREATE INDEX "WaveTask_status_createdAt_idx" ON "WaveTask"("status", "createdAt");
