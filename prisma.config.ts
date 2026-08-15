import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolvePrismaDatabaseUrl } from "./lib/database-url-core";

const resolved = resolvePrismaDatabaseUrl();

if (!resolved.url) {
  const invalid = resolved.invalid?.length
    ? ` Invalid values found for: ${resolved.invalid.join(", ")}.`
    : "";
  throw new Error(
    `No valid PostgreSQL database URL found. Set DATABASE_URL in Vercel to a pooled Neon URL starting with postgresql:// (no quotes).${invalid}`,
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  datasource: {
    url: resolved.url,
  },
});
