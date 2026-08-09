import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { embedLessonVisuals } from "./visual-frame-art.mjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function themeForCourse(slug) {
  if (String(slug).includes("ladder")) return "ladder";
  return "harassment";
}

function resolveSourcePptx(slug) {
  const candidates = [
    path.join(repoRoot, "lib/seed/sources", `${slug}.pptx`),
    path.join(repoRoot, "course-sources", `${slug}.pptx`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

async function main() {
  const courses = await prisma.masonCourse.findMany({
    select: {
      slug: true,
      sections: {
        select: {
          id: true,
          title: true,
          lessonPlan: true,
        },
      },
    },
  });

  let updatedSections = 0;
  let updatedVisuals = 0;

  for (const course of courses) {
    const theme = themeForCourse(course.slug);
    const pptxPath = resolveSourcePptx(course.slug);
    const pptxBuffer = pptxPath ? fs.readFileSync(pptxPath) : null;

    for (const section of course.sections) {
      const lessonPlan = section.lessonPlan;
      if (!lessonPlan || typeof lessonPlan !== "object") continue;

      const visualCount = Array.isArray(lessonPlan.moments)
        ? lessonPlan.moments.filter((moment) => moment.kind === "visual").length
        : 0;
      if (!visualCount) continue;

      const nextPlan = await embedLessonVisuals(lessonPlan, {
        theme,
        pptxBuffer,
      });
      await prisma.masonSection.update({
        where: { id: section.id },
        data: {
          lessonPlan: nextPlan,
          updatedAt: new Date(),
        },
      });

      updatedSections += 1;
      updatedVisuals += visualCount;
      console.log(
        `Updated ${course.slug} / ${section.title}: ${visualCount} visual explainer(s)`,
      );
    }
  }

  console.log(
    `Done. Refreshed ${updatedVisuals} visual explainer(s) across ${updatedSections} section(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
