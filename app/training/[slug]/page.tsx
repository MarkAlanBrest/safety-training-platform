import { notFound, redirect } from "next/navigation";
import GeneratedTrainingPage from "@/components/GeneratedTrainingPage";
import ScormClassroomShell from "@/components/ScormClassroomShell";
import { prisma } from "@/lib/prisma";
import { learnerCoursePath } from "@/lib/course-routes";
import {
  demoCourse,
  sanitizeCourseForLearner,
  type LessonPlan,
  type PublicMasonCourse,
} from "@/lib/mason";
import { workplaceHarassmentExampleCourse } from "@/lib/workplace-harassment-example";
import { scormInstructorConfigFromLessonPlan } from "@/lib/scorm-instructor";
import { narrationScriptFromStoredCourse } from "@/lib/scorm-course-create";

export const dynamic = "force-dynamic";

export default async function TrainingCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "demo") {
    return <GeneratedTrainingPage course={sanitizeCourseForLearner(demoCourse)} />;
  }
  if (slug === "workplace-sexual-harassment-prevention") {
    return (
      <GeneratedTrainingPage
        course={sanitizeCourseForLearner(workplaceHarassmentExampleCourse)}
      />
    );
  }

  const record = await prisma.masonCourse.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          position: true,
          fileName: true,
          estimatedMinutes: true,
          lessonPlan: true,
        },
      },
    },
  });
  if (!record) notFound();
  if (record.courseType === "classroom") {
    redirect(learnerCoursePath(record.slug, record.courseType));
  }
  if (record.courseType === "scorm") {
    if (!record.scormEntryPoint || !record.scormVersion) notFound();
    const savedInstructor = scormInstructorConfigFromLessonPlan(record.sections[0]?.lessonPlan);
    const embeddedScript = savedInstructor.narration.length
      ? null
      : await narrationScriptFromStoredCourse(record.id);
    return (
      <ScormClassroomShell
        course={{
          title: record.title,
          slug: record.slug,
          description: record.description,
          scormVersion: record.scormVersion,
          scormEntryPoint: record.scormEntryPoint,
          instructor: embeddedScript
            ? {
                ...savedInstructor,
                narration: embeddedScript.cues,
                opening: savedInstructor.opening || embeddedScript.opening,
              }
            : savedInstructor,
        }}
      />
    );
  }
  if (record.sections.length === 0) notFound();

  const course: PublicMasonCourse = sanitizeCourseForLearner({
    ...record,
    displayMode: record.displayMode === "slideshow" ? "slideshow" : "webpage",
    sections: record.sections.map((section) => ({
      ...section,
      lessonPlan: section.lessonPlan as unknown as LessonPlan,
    })),
  });

  return <GeneratedTrainingPage course={course} />;
}
