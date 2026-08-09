export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { classroomChapterSlideAssetPath } from "@/lib/classroom-chapters";
import { getAdminSession } from "@/lib/admin-session";
import { readScormAssetContent } from "@/lib/scorm-asset-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; chapter: string; index: string }> },
) {
  const { slug, chapter, index } = await params;
  const chapterPosition = Number(chapter);
  const slideIndex = Number(index);
  if (
    !Number.isInteger(chapterPosition) ||
    chapterPosition < 2 ||
    !Number.isInteger(slideIndex) ||
    slideIndex < 0
  ) {
    return new Response("Invalid slide reference.", { status: 400 });
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

  const assetPath = classroomChapterSlideAssetPath(chapterPosition, slideIndex);
  const asset = await prisma.scormAsset.findUnique({
    where: {
      courseId_path: {
        courseId: course.id,
        path: assetPath,
      },
    },
    select: { mimeType: true },
  });
  if (!asset) return new Response("Slide image not found.", { status: 404 });

  try {
    const content = await readScormAssetContent(course.id, assetPath);
    return new Response(content, {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Slide image not found.", { status: 404 });
  }
}
