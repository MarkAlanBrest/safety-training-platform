export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { classroomSlideAssetPath } from "@/lib/classroom";
import { getAdminSession } from "@/lib/admin-session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; index: string; imageIndex: string }> },
) {
  const { slug, index, imageIndex } = await params;
  const slideIndex = Number(index);
  const visualIndex = Number(imageIndex);
  if (
    !Number.isInteger(slideIndex) ||
    slideIndex < 0 ||
    !Number.isInteger(visualIndex) ||
    visualIndex < 0
  ) {
    return new Response("Invalid slide index.", { status: 400 });
  }

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
        path: classroomSlideAssetPath(slideIndex, visualIndex),
      },
    },
  });
  if (!asset) return new Response("Slide image not found.", { status: 404 });

  return new Response(asset.content, {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
