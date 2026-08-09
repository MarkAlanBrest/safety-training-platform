export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";
import { isClassroomPlan } from "@/lib/classroom";
import { buildDefaultScormLessonPlan, scormInstructorConfigFromLessonPlan } from "@/lib/scorm-instructor";
import { normalizeScormNarrationCues } from "@/lib/scorm-narration-document";
import { narrationScriptFromStoredCourse } from "@/lib/scorm-course-create";

type PatchBody = {
  opening?: string;
  scormNarration?: Array<{ location?: string; text?: string }>;
};

async function loadScormCourse(slug: string) {
  return prisma.masonCourse.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { position: "asc" },
        take: 1,
        select: { id: true, lessonPlan: true },
      },
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const course = await loadScormCourse(slug);
  if (!course || course.courseType !== "scorm") {
    return Response.json({ error: "SCORM course not found." }, { status: 404 });
  }

  const section = course.sections[0];
  const instructor = scormInstructorConfigFromLessonPlan(section?.lessonPlan);
  const embeddedScript = instructor.narration.length
    ? null
    : await narrationScriptFromStoredCourse(course.id);

  return Response.json({
    title: course.title,
    slug: course.slug,
    scormVersion: course.scormVersion,
    scormEntryPoint: course.scormEntryPoint,
    opening: instructor.opening || embeddedScript?.opening || course.description || "",
    scormNarration: instructor.narration.length
      ? instructor.narration
      : embeddedScript?.cues || [],
    sectionId: section?.id ?? null,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const body = (await request.json()) as PatchBody;
  const course = await loadScormCourse(slug);
  if (!course || course.courseType !== "scorm") {
    return Response.json({ error: "SCORM course not found." }, { status: 404 });
  }

  const opening = String(body.opening || "").trim();
  const scormNarration = normalizeScormNarrationCues(body.scormNarration);

  let section = course.sections[0];
  if (!section) {
    section = await prisma.masonSection.create({
      data: {
        courseId: course.id,
        title: "SCORM package",
        position: 1,
        estimatedMinutes: course.estimatedMinutes,
        fileName: "scorm-package",
        lessonPlan: buildDefaultScormLessonPlan({
          title: course.title,
          description: opening || course.description || undefined,
        }) as Prisma.InputJsonValue,
      },
      select: { id: true, lessonPlan: true },
    });
  }

  const currentPlan =
    section.lessonPlan && isClassroomPlan(section.lessonPlan)
      ? section.lessonPlan
      : buildDefaultScormLessonPlan({
          title: course.title,
          description: course.description || undefined,
        });

  const nextPlan = {
    ...currentPlan,
    opening: opening || currentPlan.opening,
    scormNarration,
  };

  await prisma.masonSection.update({
    where: { id: section.id },
    data: { lessonPlan: nextPlan as Prisma.InputJsonValue },
  });

  if (opening && opening !== course.description) {
    await prisma.masonCourse.update({
      where: { id: course.id },
      data: { description: opening },
    });
  }

  return Response.json({
    opening: nextPlan.opening,
    scormNarration,
  });
}
