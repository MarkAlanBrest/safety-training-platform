import "dotenv/config";
import { defineConfig } from "prisma/config";

function resolveDirectDatabaseUrl() {
  return (
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL
  )?.trim();
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  datasource: {
    url: resolveDirectDatabaseUrl(),
  },
});
