ALTER TABLE "WaveTask"
ADD COLUMN "lastSeenBriefId" TEXT,
ADD COLUMN "lastSeenAt" TIMESTAMP(3),
ADD COLUMN "seenCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "WaveTask"
ADD CONSTRAINT "WaveTask_lastSeenBriefId_fkey"
FOREIGN KEY ("lastSeenBriefId")
REFERENCES "WaveBrief"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "WaveTask_lastSeenBriefId_idx" ON "WaveTask"("lastSeenBriefId");
