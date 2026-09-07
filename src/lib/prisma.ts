import {
  PrismaPg,
} from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "@/generated/prisma/client";

const databaseUrl =
  process.env.DATABASE_URL;

if (
  !databaseUrl
) {
  throw new Error(
    "DATABASE_URL ortam değişkeni tanımlı değil.",
  );
}

const globalForPrisma =
  globalThis as unknown as {
    betProjectPrisma?:
      PrismaClient;
  };

function createPrismaClient():
  PrismaClient {
  const adapter =
    new PrismaPg({
      connectionString:
        databaseUrl,
    });

  return new PrismaClient({
    adapter,
  });
}

export const prisma =
  globalForPrisma
    .betProjectPrisma ??
  createPrismaClient();

if (
  process.env.NODE_ENV !==
  "production"
) {
  globalForPrisma
    .betProjectPrisma =
    prisma;
}