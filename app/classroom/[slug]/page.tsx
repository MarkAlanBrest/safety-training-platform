import { notFound } from "next/navigation";
import ClassroomShell from "@/components/classroom/ClassroomShell";
import { prisma } from "@/lib/prisma";
import {
  classroomCourseForSlug,
  isClassroomPlan,
  type PublicClassroomCourse,
} from "@/lib/classroom";

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
        take: 1,
        select: { lessonPlan: true },
      },
    },
  });

  if (!record || record.courseType !== "classroom") notFound();
  const plan = record.sections[0]?.lessonPlan;
  if (!isClassroomPlan(plan)) notFound();

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

  return <ClassroomShell course={course} />;
}
