import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClient | undefined;
};

export function getPrisma(): PrismaClient {
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;

  const client = new PrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__prisma = client;
  }

  return client;
}
