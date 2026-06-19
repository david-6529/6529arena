CREATE TABLE "WaveTaskComment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "author" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaveTaskComment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WaveTaskComment"
  ADD CONSTRAINT "WaveTaskComment_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "WaveTask"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WaveTaskComment_taskId_createdAt_idx" ON "WaveTaskComment"("taskId", "createdAt");
