ALTER TABLE "WaveTask"
ADD COLUMN "outcomeScore" INTEGER,
ADD COLUMN "outcomeScoreNotes" TEXT,
ADD COLUMN "outcomeReviewedBy" TEXT,
ADD COLUMN "outcomeReviewedAt" TIMESTAMP(3);
