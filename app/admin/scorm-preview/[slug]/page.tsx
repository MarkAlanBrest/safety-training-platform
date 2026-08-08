import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ScormClassroomShell from "@/components/ScormClassroomShell";
import { ADMIN_COOKIE, hashSessionToken } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { scormInstructorConfigFromLessonPlan } from "@/lib/scorm-instructor";

export const dynamic = "force-dynamic";

export default async function AdminScormPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) redirect("/admin/login");

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { admin: { select: { active: true } } },
  });
  if (!session || !session.admin.active || session.expiresAt.getTime() <= Date.now()) redirect("/admin/login");

  const { slug } = await params;
  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { position: "asc" },
        take: 1,
        select: { lessonPlan: true },
      },
    },
  });
  if (!course || course.courseType !== "scorm" || !course.scormVersion || !course.scormEntryPoint) {
    notFound();
  }

  return (
    <ScormClassroomShell
      preview
      course={{
        title: course.title,
        slug: course.slug,
        description: course.description,
        scormVersion: course.scormVersion,
        scormEntryPoint: course.scormEntryPoint,
        instructor: scormInstructorConfigFromLessonPlan(course.sections[0]?.lessonPlan),
      }}
    />
  );
}
