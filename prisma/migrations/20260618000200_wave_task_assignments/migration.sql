ALTER TABLE "WaveTask"
ADD COLUMN "assignedTo" TEXT,
ADD COLUMN "claimedBy" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE INDEX "WaveTask_assignedTo_status_idx" ON "WaveTask"("assignedTo", "status");
