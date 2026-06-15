CREATE TABLE "AppEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "message" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "battleId" TEXT,
  "actor" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppEvent_type_createdAt_idx" ON "AppEvent"("type", "createdAt");
CREATE INDEX "AppEvent_battleId_createdAt_idx" ON "AppEvent"("battleId", "createdAt");
CREATE INDEX "AppEvent_entityType_entityId_idx" ON "AppEvent"("entityType", "entityId");
CREATE INDEX "AppEvent_severity_createdAt_idx" ON "AppEvent"("severity", "createdAt");
