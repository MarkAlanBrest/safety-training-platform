import "dotenv/config";
import { defineConfig } from "prisma/config";
import {
  describeDatabaseUrl,
  resolvePrismaDatabaseUrl,
} from "./lib/database-url-core";

const resolved = resolvePrismaDatabaseUrl();

if (!resolved.url) {
  const details = resolved.invalid?.join("; ") || describeDatabaseUrl(process.env.DATABASE_URL);
  throw new Error(
    `DATABASE_URL is invalid. ${details}. Set DATABASE_URL in Vercel to a Neon pooled URL starting with postgresql:// (no quotes).`,
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  datasource: {
    url: resolved.url,
  },
});
