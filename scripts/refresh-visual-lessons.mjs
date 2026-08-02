import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { embedVisualFrameImages } from "./visual-frame-art.mjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

function themeForCourse(slug) {
  if (String(slug).includes("ladder")) return "ladder";
  return "harassment";
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

    for (const section of course.sections) {
      const lessonPlan = section.lessonPlan;
      if (!lessonPlan || typeof lessonPlan !== "object") continue;

      const visualCount = Array.isArray(lessonPlan.moments)
        ? lessonPlan.moments.filter((moment) => moment.kind === "visual").length
        : 0;
      if (!visualCount) continue;

      const nextPlan = embedVisualFrameImages(lessonPlan, theme);
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
