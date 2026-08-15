import { describeDatabaseUrl, resolvePrismaDatabaseUrl } from "../lib/database-url-core.ts";

const resolved = resolvePrismaDatabaseUrl(process.env);

if (!resolved.url) {
  console.error("Database URL check failed.");
  console.error(`DATABASE_URL: ${describeDatabaseUrl(process.env.DATABASE_URL)}`);
  if (resolved.invalid?.length) {
    console.error(`Details: ${resolved.invalid.join("; ")}`);
  }
  console.error(
    "Fix: In Vercel, set DATABASE_URL to your Neon pooled connection string.\n" +
      "It must start with postgresql:// and must not include quotes or spaces.",
  );
  process.exit(1);
}

console.log(`Database URL check passed (using ${resolved.source}).`);
