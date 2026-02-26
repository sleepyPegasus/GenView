import type { PrismaClient as PrismaClientType } from "@/generated/prisma/client";

let _prisma: PrismaClientType | null = null;

const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClientType | undefined;
};

export function getPrisma(): PrismaClientType {
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;
  if (_prisma) return _prisma;

  // Dynamic import to avoid build-time connection
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@/generated/prisma/client");
  _prisma = new PrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__prisma = _prisma!;
  }

  return _prisma!;
}
