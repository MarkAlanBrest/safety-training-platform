/**
 * Delete unused video / classroom bulk data from Neon to reclaim storage.
 *
 * Does NOT reset Neon's monthly data-transfer quota. If queries return 53000
 * (quota exceeded), upgrade Neon or wait for reset before this script can run.
 *
 * Keeps: AdminUser, AdminSession, SCORM courses, PDF courses, enrollments for kept courses.
 * Deletes:
 *   - ScormAsset rows with video/* mime types
 *   - MasonCourse rows with courseType = "classroom" (cascades assets/sections/etc.)
 *   - SpeechCache (regenerable TTS audio)
 *   - Orphan staged classroom upload chunks under classroom/uploads/
 *
 * Usage:
 *   DRY_RUN=1 npm run db:cleanup-unused
 *   npm run db:cleanup-unused
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL (or DIRECT_URL) is not configured.");
}

const dryRun = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function mb(bytes) {
  return `${(Number(bytes || 0) / (1024 * 1024)).toFixed(2)} MB`;
}

async function assetSizeSummary() {
  const rows = await prisma.$queryRaw`
    SELECT
      "mimeType" AS mime_type,
      COUNT(*)::int AS row_count,
      COALESCE(SUM(octet_length(content)), 0)::bigint AS total_bytes
    FROM "ScormAsset"
    GROUP BY "mimeType"
    ORDER BY total_bytes DESC
  `;
  return rows;
}

async function courseTypeSummary() {
  return prisma.masonCourse.groupBy({
    by: ["courseType"],
    _count: { _all: true },
  });
}

async function main() {
  console.log(dryRun ? "DRY RUN — no deletes will be committed." : "LIVE RUN — deleting unused video/classroom data.");

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/53000|data transfer quota|Upgrade your plan/i.test(detail)) {
      throw new Error(
        "Neon data-transfer quota is still exceeded, so deletes cannot run yet. Upgrade Neon or wait for the quota to reset, then re-run. Meanwhile you can paste the SQL from the script header into the Neon SQL Editor if the console still accepts writes.",
      );
    }
    throw error;
  }

  console.log("\nCourse counts by type:");
  for (const row of await courseTypeSummary()) {
    console.log(`  ${row.courseType}: ${row._count._all}`);
  }

  console.log("\nAsset storage by mime type:");
  for (const row of await assetSizeSummary()) {
    console.log(`  ${row.mime_type}: ${row.row_count} rows, ${mb(row.total_bytes)}`);
  }

  const speechCount = await prisma.speechCache.count();
  console.log(`\nSpeechCache rows: ${speechCount}`);

  const videoAssets = await prisma.scormAsset.count({
    where: { mimeType: { startsWith: "video/" } },
  });
  const classroomCourses = await prisma.masonCourse.count({
    where: { courseType: "classroom" },
  });
  const stagedUploads = await prisma.scormAsset.count({
    where: { path: { startsWith: "classroom/uploads/" } },
  });

  console.log("\nPlanned deletes:");
  console.log(`  video/* assets: ${videoAssets}`);
  console.log(`  classroom courses: ${classroomCourses}`);
  console.log(`  staged classroom/uploads/* assets: ${stagedUploads}`);
  console.log(`  SpeechCache rows: ${speechCount}`);

  if (dryRun) {
    console.log("\nRe-run without DRY_RUN=1 to apply.");
    return;
  }

  const deletedVideos = await prisma.scormAsset.deleteMany({
    where: { mimeType: { startsWith: "video/" } },
  });
  console.log(`Deleted video assets: ${deletedVideos.count}`);

  const deletedStaged = await prisma.scormAsset.deleteMany({
    where: { path: { startsWith: "classroom/uploads/" } },
  });
  console.log(`Deleted staged upload assets: ${deletedStaged.count}`);

  const deletedClassroom = await prisma.masonCourse.deleteMany({
    where: { courseType: "classroom" },
  });
  console.log(`Deleted classroom courses: ${deletedClassroom.count}`);

  const deletedSpeech = await prisma.speechCache.deleteMany({});
  console.log(`Cleared SpeechCache rows: ${deletedSpeech.count}`);

  console.log("\nAfter cleanup — course counts:");
  for (const row of await courseTypeSummary()) {
    console.log(`  ${row.courseType}: ${row._count._all}`);
  }
  console.log("\nAfter cleanup — asset storage:");
  for (const row of await assetSizeSummary()) {
    console.log(`  ${row.mime_type}: ${row.row_count} rows, ${mb(row.total_bytes)}`);
  }
  console.log("\nDone. SCORM/PDF courses and admins were kept.");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
  await pool.end();
}
