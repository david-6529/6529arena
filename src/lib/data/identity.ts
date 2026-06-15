import { getPrisma } from "@/lib/db/prisma";

export async function cleanupExpiredIdentityChallenges() {
  const db = getPrisma();
  const deleted = await db.identityChallenge.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lt: new Date(),
          },
        },
        {
          status: {
            in: ["used", "expired"],
          },
          createdAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      ],
    },
  });

  return deleted.count;
}
