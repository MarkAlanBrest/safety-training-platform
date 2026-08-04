export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { classroomChapterDeckAssetPath } from "@/lib/classroom-chapters";
import { getAdminSession } from "@/lib/admin-session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    select: { id: true, published: true, courseType: true },
  });
  if (!course || course.courseType !== "classroom") {
    return new Response("Course not found.", { status: 404 });
  }

  const admin = !course.published ? await getAdminSession(request) : null;
  if (!course.published && !admin) {
    return new Response("Course not found.", { status: 404 });
  }

  const asset = await prisma.scormAsset.findUnique({
    where: {
      courseId_path: {
        courseId: course.id,
        path: classroomChapterDeckAssetPath(1),
      },
    },
  });
  if (!asset) return new Response("Presentation file not found.", { status: 404 });

  return new Response(asset.content, {
    headers: {
      "Content-Type":
        asset.mimeType ||
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
