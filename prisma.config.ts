import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDirectDatabaseUrl } from "@/lib/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",

  datasource: {
    url: resolveDirectDatabaseUrl() || undefined,
  },
});
