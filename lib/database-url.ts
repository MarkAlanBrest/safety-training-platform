import "server-only";

const NEON_HOST =
  /^ep-[a-z0-9-]+\.(?:[a-z0-9-]+\.)?(?:aws\.neon\.tech|neon\.tech)$/i;

export function resolveDatabaseUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;

  if (!raw?.trim()) return null;
  return normalizeNeonPoolerUrl(raw.trim());
}

export function resolveDirectDatabaseUrl() {
  const raw =
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  return raw?.trim() || null;
}

/** Route Neon direct hostnames through the pooler for serverless runtimes. */
export function normalizeNeonPoolerUrl(connectionString: string) {
  try {
    const url = new URL(connectionString);
    if (!url.hostname.includes("neon.tech") || url.hostname.includes("-pooler")) {
      return connectionString;
    }
    if (!NEON_HOST.test(url.hostname)) {
      return connectionString;
    }

    url.hostname = url.hostname.replace(/^ep-([^.]+)\./i, "ep-$1-pooler.");
    if (!url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}
