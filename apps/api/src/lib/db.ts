import { PrismaClient as WorkerPrismaClient } from "../generated/prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient as NodePrismaClient } from "@prisma/client";

let prisma: WorkerPrismaClient | null = null;

/** Initialize with a D1 binding (Cloudflare Workers) */
export function initDbD1(d1: D1Database): void {
  const adapter = new PrismaD1(d1);
  prisma = new WorkerPrismaClient({ adapter });
}

/** Initialize with a datasource URL (local Node.js dev) */
export function initDb(datasourceUrl?: string): void {
  if (!prisma) {
    prisma = new NodePrismaClient({
      datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    }) as unknown as WorkerPrismaClient;
  }
}

export function getDb(): WorkerPrismaClient {
  if (!prisma) {
    prisma = new NodePrismaClient() as unknown as WorkerPrismaClient;
  }
  return prisma;
}

/** Reset the singleton (for tests) */
export function resetDb(): void {
  prisma = null;
}
