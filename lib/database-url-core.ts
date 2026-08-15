const POSTGRES_SCHEME = /^postgres(ql)?:\/\//i;

export function sanitizeDatabaseUrl(raw?: string | null) {
  if (!raw) return null;

  let value = raw.replace(/^\uFEFF/, "").trim();
  value = value.replace(/^[\u201C\u201D\u2018\u2019"']+|[\u201C\u201D\u2018\u2019"']+$/g, "");

  if (value.startsWith("DATABASE_URL=")) {
    value = value.slice("DATABASE_URL=".length).trim();
  }

  return value || null;
}

export function isValidPostgresDatabaseUrl(value: string) {
  return POSTGRES_SCHEME.test(value);
}

export function describeDatabaseUrl(raw?: string | null) {
  const sanitized = sanitizeDatabaseUrl(raw);
  if (!sanitized) {
    return "missing or empty";
  }

  const scheme = sanitized.split(":")[0] || "";
  const startsWith = JSON.stringify(sanitized.slice(0, Math.min(20, sanitized.length)));
  return `length=${sanitized.length}, scheme=${JSON.stringify(scheme)}, startsWith=${startsWith}`;
}

export function resolvePrismaDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const sanitized = sanitizeDatabaseUrl(env.DATABASE_URL);
  if (sanitized && isValidPostgresDatabaseUrl(sanitized)) {
    return { url: sanitized, source: "DATABASE_URL" as const };
  }

  return {
    url: null,
    source: null,
    invalid: env.DATABASE_URL
      ? [`DATABASE_URL (${describeDatabaseUrl(env.DATABASE_URL)})`]
      : ["DATABASE_URL (missing)"],
  };
}
