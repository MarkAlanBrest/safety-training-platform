import { prisma } from "@/lib/prisma";
import { classroomPlanForSlug, isClassroomPlan, type ClassroomPlan } from "@/lib/classroom";

/**
 * Resolves a Classroom course's plan (and DB id, when it has one) by slug.
 * The built-in "demo" course has no database row — callers must treat a
 * null courseId as "don't persist" (e.g. skip attempt/certificate writes).
 */
export async function resolveClassroomCourse(
  slug: string,
  chapterPosition?: number,
): Promise<{ courseId: number | null; plan: ClassroomPlan } | null> {
  const staticPlan = classroomPlanForSlug(slug);
  if (staticPlan) return { courseId: null, plan: staticPlan };

  const course = await prisma.masonCourse.findUnique({
    where: { slug, courseType: "classroom" },
    include: {
      sections: { orderBy: { position: "asc" }, select: { position: true, lessonPlan: true } },
    },
  });
  const section = chapterPosition
    ? course?.sections.find((item: { position: number }) => item.position === chapterPosition)
    : course?.sections[0];
  const plan = section?.lessonPlan;
  if (!course || !isClassroomPlan(plan)) return null;
  return { courseId: course.id, plan };
}
