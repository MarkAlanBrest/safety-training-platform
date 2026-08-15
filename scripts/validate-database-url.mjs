import { resolvePrismaDatabaseUrl } from "../lib/database-url-core.ts";

const resolved = resolvePrismaDatabaseUrl(process.env);

if (!resolved.url) {
  const invalid = resolved.invalid?.length
    ? `\nInvalid values found for: ${resolved.invalid.join(", ")}`
    : "";
  console.error(
    `Database URL check failed.${invalid}\n` +
      "Set DATABASE_URL in Vercel to your Neon pooled connection string.\n" +
      "It must start with postgresql:// and must not include quotes.",
  );
  process.exit(1);
}

console.log(`Database URL check passed (using ${resolved.source}).`);
