CREATE TABLE "IdentityChallenge" (
  "id" TEXT NOT NULL,
  "wallet" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdentityChallenge_nonce_key" ON "IdentityChallenge"("nonce");
CREATE INDEX "IdentityChallenge_wallet_status_idx" ON "IdentityChallenge"("wallet", "status");
CREATE INDEX "IdentityChallenge_expiresAt_idx" ON "IdentityChallenge"("expiresAt");

ALTER TABLE "IdentityChallenge" ADD CONSTRAINT "IdentityChallenge_wallet_fkey"
  FOREIGN KEY ("wallet") REFERENCES "Identity"("wallet") ON DELETE CASCADE ON UPDATE CASCADE;
