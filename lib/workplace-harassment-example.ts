import type { PublicMasonCourse } from "@/lib/mason";
import { harassmentCourseDefinition } from "@/lib/seed/workplace-harassment-course.mjs";

export const workplaceHarassmentExampleCourse: PublicMasonCourse = {
  id: 0,
  title: harassmentCourseDefinition.title,
  slug: harassmentCourseDefinition.slug,
  description: harassmentCourseDefinition.description,
  audience: harassmentCourseDefinition.audience,
  theme: harassmentCourseDefinition.theme,
  intensity: harassmentCourseDefinition.intensity,
  estimatedMinutes: harassmentCourseDefinition.estimatedMinutes,
  displayMode:
    harassmentCourseDefinition.displayMode === "slideshow" ? "slideshow" : "webpage",
  published: harassmentCourseDefinition.published,
  sections: harassmentCourseDefinition.sections.map((section, index) => ({
    id: index,
    title: section.title,
    position: index + 1,
    fileName: "Editorial course content",
    estimatedMinutes: section.estimatedMinutes,
    lessonPlan: section.lessonPlan,
  })),
};
