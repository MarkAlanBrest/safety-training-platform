import type { LessonPlan } from "@/lib/mason";
import { demoCourse } from "@/lib/mason";

export function lessonPlanForChat({
  courseSlug,
  sectionId,
}: {
  courseSlug?: string;
  sectionIndex?: number;
  sectionId?: number;
}): LessonPlan | null {
  if (courseSlug === "demo" || sectionId === 0) {
    return demoCourse.sections[0]?.lessonPlan ?? null;
  }

  return null;
}
