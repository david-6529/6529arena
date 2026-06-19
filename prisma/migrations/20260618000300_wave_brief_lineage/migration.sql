ALTER TABLE "WaveBrief"
ADD COLUMN "previousBriefId" TEXT;

ALTER TABLE "WaveBrief"
ADD CONSTRAINT "WaveBrief_previousBriefId_fkey"
FOREIGN KEY ("previousBriefId")
REFERENCES "WaveBrief"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "WaveBrief_previousBriefId_idx" ON "WaveBrief"("previousBriefId");
