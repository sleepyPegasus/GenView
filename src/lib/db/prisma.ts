import { PrismaClient } from "../../generated/prisma/client";

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClientInstance | undefined;
};

export function getPrisma(): PrismaClientInstance {
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;

  // Prisma v7 types require an options object, but it works fine without one at runtime
  const client = new (PrismaClient as unknown as new () => PrismaClientInstance)();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__prisma = client;
  }

  return client;
}
