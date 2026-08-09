import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

function createPool() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. Set DATABASE_URL (Neon pooled URL) on Vercel.",
    );
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const configuredMax = Number(process.env.DATABASE_POOL_MAX || 0);

  return new Pool({
    connectionString,
    max: configuredMax > 0 ? configuredMax : isServerless ? 1 : 10,
    idleTimeoutMillis: isServerless ? 1000 : 5000,
    connectionTimeoutMillis: 10_000,
    ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
  });
}

function createPrismaClient() {
  const pool = globalForPrisma.pool ?? createPool();
  globalForPrisma.pool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
