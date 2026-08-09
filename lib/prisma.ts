import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

function databaseUrl() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return connectionString;
}

function createPool() {
  return new Pool({
    connectionString: databaseUrl(),
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10_000,
    ssl: databaseUrl().includes("sslmode=disable") ? false : { rejectUnauthorized: false },
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
