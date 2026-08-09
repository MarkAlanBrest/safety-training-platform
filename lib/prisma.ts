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

  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: 5000,
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
