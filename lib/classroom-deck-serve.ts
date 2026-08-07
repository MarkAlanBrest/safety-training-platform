import { prisma } from "@/lib/prisma";
import { classroomChapterDeckAssetPath } from "@/lib/classroom-chapters";

type ServeDeckOptions = {
  slug: string;
  chapterPosition?: number;
  /** When true, only published courses are served and headers are Office-embed friendly. */
  publicEmbed?: boolean;
  allowUnpublished?: boolean;
};

export async function serveClassroomDeck({
  slug,
  chapterPosition = 1,
  publicEmbed = false,
  allowUnpublished = false,
}: ServeDeckOptions): Promise<Response> {
  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    select: { id: true, published: true, courseType: true },
  });
  if (!course || course.courseType !== "classroom") {
    return new Response("Course not found.", { status: 404 });
  }

  if (publicEmbed) {
    if (!course.published) {
      return new Response("Course not found.", { status: 404 });
    }
  } else if (!course.published && !allowUnpublished) {
    return new Response("Course not found.", { status: 404 });
  }

  const asset = await prisma.scormAsset.findUnique({
    where: {
      courseId_path: {
        courseId: course.id,
        path: classroomChapterDeckAssetPath(chapterPosition),
      },
    },
  });
  if (!asset) {
    return new Response("Presentation file not found.", { status: 404 });
  }

  const mimeType =
    asset.mimeType ||
    "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  return new Response(asset.content, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": 'inline; filename="presentation.pptx"',
      "Cache-Control": publicEmbed ? "public, max-age=3600" : "private, max-age=86400",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
