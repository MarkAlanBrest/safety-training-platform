import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ScormPlayer from "@/components/ScormPlayer";
import { ADMIN_COOKIE, hashSessionToken } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

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
    select: { title: true, slug: true, courseType: true, scormVersion: true, scormEntryPoint: true },
  });
  if (!course || course.courseType !== "scorm" || !course.scormVersion || !course.scormEntryPoint) notFound();

  return (
    <ScormPlayer
      title={course.title}
      slug={course.slug}
      version={course.scormVersion}
      entryPoint={course.scormEntryPoint}
      preview
    />
  );
}
