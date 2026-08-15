import "dotenv/config";
import { defineConfig } from "prisma/config";

function sanitizeDatabaseUrl(raw?: string | null) {
  if (!raw) return null;
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (value.startsWith("DATABASE_URL=")) {
    value = value.slice("DATABASE_URL=".length).trim();
  }
  return value || null;
}

function resolveDirectDatabaseUrl() {
  const candidates = [
    process.env.DIRECT_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
  ];

  for (const candidate of candidates) {
    const sanitized = sanitizeDatabaseUrl(candidate);
    if (!sanitized) continue;
    if (/^postgres(ql)?:\/\//i.test(sanitized)) return sanitized;
  }

  return null;
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  datasource: {
    url: resolveDirectDatabaseUrl(),
  },
});
