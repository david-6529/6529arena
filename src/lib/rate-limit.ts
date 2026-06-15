import { getPrisma } from "@/lib/db/prisma";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export async function consumeRateLimit(params: {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const db = getPrisma();
  const key = `${params.scope}:${params.identifier}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + params.windowMs);
  const existing = await db.rateLimitBucket.findUnique({ where: { key } });

  if (!existing || existing.resetAt <= now) {
    await db.rateLimitBucket.upsert({
      where: { key },
      update: {
        count: 1,
        resetAt,
      },
      create: {
        key,
        count: 1,
        resetAt,
      },
    });

    return {
      allowed: true,
      remaining: Math.max(0, params.limit - 1),
      resetAt,
    };
  }

  if (existing.count >= params.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  const updated = await db.rateLimitBucket.update({
    where: { key },
    data: {
      count: { increment: 1 },
    },
  });

  return {
    allowed: true,
    remaining: Math.max(0, params.limit - updated.count),
    resetAt: updated.resetAt,
  };
}

export async function cleanupExpiredRateLimits() {
  const db = getPrisma();
  const deleted = await db.rateLimitBucket.deleteMany({
    where: {
      resetAt: {
        lt: new Date(),
      },
    },
  });

  return deleted.count;
}
