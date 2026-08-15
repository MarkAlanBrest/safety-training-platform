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

export function resolvePrismaDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const candidates: Array<{ name: string; value?: string }> = [
    { name: "DATABASE_URL", value: env.DATABASE_URL },
    { name: "DIRECT_URL", value: env.DIRECT_URL },
    { name: "DATABASE_URL_UNPOOLED", value: env.DATABASE_URL_UNPOOLED },
    { name: "POSTGRES_URL_NON_POOLING", value: env.POSTGRES_URL_NON_POOLING },
    { name: "POSTGRES_URL", value: env.POSTGRES_URL },
    { name: "POSTGRES_PRISMA_URL", value: env.POSTGRES_PRISMA_URL },
  ];

  for (const candidate of candidates) {
    const sanitized = sanitizeDatabaseUrl(candidate.value);
    if (!sanitized) continue;
    if (isValidPostgresDatabaseUrl(sanitized)) {
      return { url: sanitized, source: candidate.name };
    }
  }

  const invalid = candidates
    .map((candidate) => {
      const sanitized = sanitizeDatabaseUrl(candidate.value);
      if (!sanitized) return null;
      return `${candidate.name} (invalid scheme)`;
    })
    .filter((entry): entry is string => Boolean(entry));

  return { url: null, source: null, invalid };
}
