import "server-only";

import { prisma } from "@/lib/prisma";
import { classroomChapterDeckAssetPath } from "@/lib/classroom-chapters";

type ServeDeckOptions = {
  slug: string;
  chapterPosition?: number;
  /** When true, only published courses are served and headers are Office-embed friendly. */
  publicEmbed?: boolean;
  allowUnpublished?: boolean;
  rangeHeader?: string | null;
};

export async function serveClassroomDeck({
  slug,
  chapterPosition = 1,
  publicEmbed = false,
  allowUnpublished = false,
  rangeHeader,
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

  const content = new Uint8Array(asset.content);
  const headers = new Headers({
    "Content-Type": mimeType,
    "Content-Disposition": 'inline; filename="presentation.pptx"',
    // Do not let a CDN cache one byte range and replay it for another. Office
    // performs its own document caching and needs every Range response intact.
    "Cache-Control": publicEmbed ? "no-store" : "private, max-age=86400",
    "CDN-Cache-Control": publicEmbed ? "no-store" : "private, max-age=86400",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type, Authorization",
    "Access-Control-Expose-Headers":
      "Accept-Ranges, Content-Length, Content-Range, Content-Type, Content-Disposition",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });

  const range = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/i);
  if (range) {
    const suffixLength = !range[1] && range[2] ? Number(range[2]) : null;
    const requestedStart = range[1]
      ? Number(range[1])
      : suffixLength !== null
        ? Math.max(0, content.byteLength - suffixLength)
        : 0;
    const requestedEnd =
      range[1] && range[2] ? Number(range[2]) : content.byteLength - 1;
    const start = Math.max(0, requestedStart);
    const end = Math.min(content.byteLength - 1, requestedEnd);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${content.byteLength}` },
      });
    }

    const partial = content.slice(start, end + 1);
    headers.set("Content-Length", String(partial.byteLength));
    headers.set("Content-Range", `bytes ${start}-${end}/${content.byteLength}`);
    return new Response(partial, { status: 206, headers });
  }

  headers.set("Content-Length", String(content.byteLength));

  return new Response(content, { headers });
}
