import "server-only";

import {
  resolvePrismaDatabaseUrl,
  sanitizeDatabaseUrl,
} from "@/lib/database-url-core";

const NEON_HOST =
  /^ep-[a-z0-9-]+\.(?:[a-z0-9-]+\.)?(?:aws\.neon\.tech|neon\.tech)$/i;

export { sanitizeDatabaseUrl } from "@/lib/database-url-core";

export function resolveDatabaseUrl() {
  const resolved = resolvePrismaDatabaseUrl();
  if (!resolved.url) return null;
  return normalizeNeonPoolerUrl(resolved.url);
}

export function resolveDirectDatabaseUrl() {
  return resolvePrismaDatabaseUrl().url;
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
