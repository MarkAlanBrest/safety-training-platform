import {
  describeDatabaseUrl,
  isValidPostgresDatabaseUrl,
  resolvePrismaDatabaseUrl,
  sanitizeDatabaseUrl,
} from "../lib/database-url-core.ts";

const ORPHAN_ENV_VARS = [
  "DIRECT_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
];

function findOrphanDatabaseEnvVars(env = process.env) {
  return ORPHAN_ENV_VARS.flatMap((name) => {
    const sanitized = sanitizeDatabaseUrl(env[name]);
    if (!sanitized) return [];
    if (isValidPostgresDatabaseUrl(sanitized)) return [];
    return [`${name}=${JSON.stringify(sanitized)}`];
  });
}

const resolved = resolvePrismaDatabaseUrl(process.env);
const orphans = findOrphanDatabaseEnvVars(process.env);

if (!resolved.url) {
  console.error("Database URL check failed.");
  console.error(`DATABASE_URL: ${describeDatabaseUrl(process.env.DATABASE_URL)}`);
  if (orphans.length) {
    console.error(
      "Broken secondary database env vars were also found (often created when a URL is split at '&'):",
    );
    for (const orphan of orphans) console.error(`- ${orphan}`);
  }
  console.error(
    "Fix: keep only DATABASE_URL in Vercel and paste the Neon pooled URL without quotes.\n" +
      "Use: postgresql://...?sslmode=require (drop &channel_binding=require).",
  );
  process.exit(1);
}

if (orphans.length) {
  console.warn("Warning: ignoring broken secondary database env vars:");
  for (const orphan of orphans) console.warn(`- ${orphan}`);
}

console.log(`Database URL check passed (using ${resolved.source}).`);
