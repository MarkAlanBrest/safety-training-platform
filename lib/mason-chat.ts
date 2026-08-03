import { demoCourse } from "@/lib/mason";
import { workplaceHarassmentExampleCourse } from "@/lib/workplace-harassment-example";
import type { LessonPlan } from "@/lib/mason";

export function lessonPlanForChat({
  courseSlug,
  sectionIndex,
  sectionId,
}: {
  courseSlug?: string;
  sectionIndex?: number;
  sectionId?: number;
}): LessonPlan | null {
  if (courseSlug === "workplace-sexual-harassment-prevention") {
    const index = Number.isInteger(sectionIndex) ? Number(sectionIndex) : 0;
    return workplaceHarassmentExampleCourse.sections[index]?.lessonPlan ?? null;
  }

  if (courseSlug === "demo" || sectionId === 0) {
    return demoCourse.sections[0]?.lessonPlan ?? null;
  }

  return null;
}
