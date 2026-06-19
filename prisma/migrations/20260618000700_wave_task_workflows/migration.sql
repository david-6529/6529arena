ALTER TABLE "WaveTask"
ADD COLUMN "workflowLabel" TEXT;

CREATE INDEX "WaveTask_workflowLabel_status_idx" ON "WaveTask"("workflowLabel", "status");
