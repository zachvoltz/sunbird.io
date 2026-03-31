import { PrismaClient } from "@prisma/client/edge";
import { PrismaD1 } from "@prisma/adapter-d1";

let prisma: PrismaClient | null = null;

/** Initialize with a D1 binding (Cloudflare Workers) */
export function initDbD1(d1: D1Database): void {
  const adapter = new PrismaD1(d1);
  prisma = new PrismaClient({ adapter } as any);
}

/** Initialize with a datasource URL (local Node.js dev) */
export function initDb(datasourceUrl?: string): void {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    } as any);
  }
}

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
