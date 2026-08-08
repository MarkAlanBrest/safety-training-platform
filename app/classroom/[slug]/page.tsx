import { notFound } from "next/navigation";
import ClassroomShell from "@/components/classroom/ClassroomShell";
import VideoClassroomShell from "@/components/classroom/VideoClassroomShell";
import { isVideoClassroomPlan } from "@/lib/classroom-video";
import { prisma } from "@/lib/prisma";
import {
  classroomCourseForSlug,
  classroomDeckUrl,
  hydrateClassroomPlan,
  isClassroomPlan,
  type PublicClassroomCourse,
} from "@/lib/classroom";
import { classroomChapterDeckAssetPath, classroomPlanFromSections } from "@/lib/classroom-chapters";

export const dynamic = "force-dynamic";

export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const staticCourse = classroomCourseForSlug(slug);
  if (staticCourse) {
    return <ClassroomShell course={staticCourse} />;
  }

  const record = await prisma.masonCourse.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, position: true, lessonPlan: true },
      },
      scormAssets: {
        where: { path: { startsWith: "classroom/" } },
        select: { path: true },
      },
    },
  });

  if (!record || record.courseType !== "classroom") notFound();

  const assetPaths = record.scormAssets.map((asset) => asset.path);
  let globalOffset = 0;
  const hydratedSections = record.sections.flatMap((section) => {
    if (!isClassroomPlan(section.lessonPlan)) return [];
    const hydrated = hydrateClassroomPlan(section.lessonPlan, slug, assetPaths, {
      chapterPosition: section.position,
      globalIndexOffset: globalOffset,
    });
    globalOffset += hydrated.slides.length;
    return [
      {
        id: section.id,
        title: section.title,
        position: section.position,
        plan: hydrated,
        deckUrl: assetPaths.includes(classroomChapterDeckAssetPath(section.position))
          ? classroomDeckUrl(slug, section.position)
          : undefined,
      },
    ];
  });

  if (!hydratedSections.length) notFound();

  const plan = classroomPlanFromSections(record.title, hydratedSections);

  const course: PublicClassroomCourse = {
    id: record.id,
    title: record.title,
    slug: record.slug,
    description: record.description,
    companyName: record.companyName,
    logoData: record.logoData,
    accentColor: record.accentColor,
    published: record.published,
    plan,
  };

  if (isVideoClassroomPlan(plan)) {
    return <VideoClassroomShell course={course} />;
  }

  return <ClassroomShell course={course} />;
}
