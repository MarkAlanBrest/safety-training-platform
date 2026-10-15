import "dotenv/config";
import pg from "pg";
import { resolvePrismaDatabaseUrl } from "../lib/database-url-core.ts";

const resolved = resolvePrismaDatabaseUrl();
if (!resolved.url) throw new Error("Configure DATABASE_URL before initializing the shop dashboard.");
const pool = new pg.Pool({
  connectionString: resolved.url,
  max: 1,
  connectionTimeoutMillis: 10000,
  ssl: resolved.url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});
try {
  // Add only our table; never push unrelated schema changes or delete existing data.
  await pool.query(`CREATE TABLE IF NOT EXISTS "ShopDashboard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log("Shop dashboard database table is ready.");
} finally {
  await pool.end();
}
