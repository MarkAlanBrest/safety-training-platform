export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { prisma } from "@/lib/prisma";
import { classroomSlideAssetPath } from "@/lib/classroom";
import { classroomChapterDeckAssetPath } from "@/lib/classroom-chapters";
import { getAdminSession } from "@/lib/admin-session";
import { renderPptxSlides } from "@/lib/pptx-render-server";

function imageResponse(content: Uint8Array, mimeType: string) {
  return new Response(Buffer.from(content), {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; index: string }> },
) {
  const { slug, index } = await params;
  const slideIndex = Number(index);
  if (!Number.isInteger(slideIndex) || slideIndex < 0) {
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
        path: classroomSlideAssetPath(slideIndex),
      },
    },
  });
  if (!asset) {
    const deck = await prisma.scormAsset.findUnique({
      where: {
        courseId_path: {
          courseId: course.id,
          path: classroomChapterDeckAssetPath(1),
        },
      },
    });
    if (!deck) return new Response("Slide image not found.", { status: 404 });

    try {
      const images = await renderPptxSlides(new Uint8Array(deck.content), {
        preset: "hd",
        format: "png",
      });
      await prisma.scormAsset.createMany({
        data: images.map((image, imageIndex) => ({
          courseId: course.id,
          path: classroomSlideAssetPath(imageIndex),
          mimeType: image.mimeType,
          content: Buffer.from(image.bytes),
        })),
        skipDuplicates: true,
      });
      const rendered = images[slideIndex];
      if (!rendered) return new Response("Slide image not found.", { status: 404 });
      return imageResponse(rendered.bytes, rendered.mimeType);
    } catch (error) {
      console.error(`Could not restore slide images for ${slug}:`, error);
      return new Response("Slide image not found.", { status: 404 });
    }
  }

  return imageResponse(asset.content, asset.mimeType);
}
