import { PrismaClient } from "@sunbird/db";

let prisma: PrismaClient | null = null;

export function initDb(datasourceUrl?: string): void {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    });
  }
}

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
