import "server-only";

const NEON_HOST =
  /^ep-[a-z0-9-]+\.(?:[a-z0-9-]+\.)?(?:aws\.neon\.tech|neon\.tech)$/i;

export function sanitizeDatabaseUrl(raw?: string | null) {
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

export function resolveDatabaseUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;

  const sanitized = sanitizeDatabaseUrl(raw);
  if (!sanitized) return null;
  return normalizeNeonPoolerUrl(sanitized);
}

export function resolveDirectDatabaseUrl() {
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
