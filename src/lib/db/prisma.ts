import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const adapter = new PrismaPg(databaseUrl);

  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.prisma ?? (hasDatabaseUrl() ? createPrismaClient() : undefined);

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}

export function getPrisma() {
  if (!prisma) {
    throw new Error("DATABASE_URL is required for this operation.");
  }

  return prisma;
}
