export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";
import {
  loadChunkedVideoSlice,
  listChunkedVideoMeta,
} from "@/lib/classroom-chunked-video";

const SAFE_ASSET_PATH = /^classroom\/(?:media|activities)\/[a-z0-9-]+(?:\.vtt)?$/;
const CHUNKED_VIDEO_PATH = /^classroom\/media\/[a-z0-9-]+$/;

function respondWithBytes(
  content: Buffer,
  mimeType: string,
  rangeHeader: string | null,
) {
  const baseHeaders = {
    "Content-Type": mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  const range = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);

  if (range && content.length) {
    const requestedStart = range[1] ? Number(range[1]) : 0;
    const requestedEnd = range[2] ? Number(range[2]) : content.length - 1;
    const start = Math.max(0, Math.min(requestedStart, content.length - 1));
    const end = Math.max(start, Math.min(requestedEnd, content.length - 1));
    const chunk = content.subarray(start, end + 1);

    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${content.length}`,
      },
    });
  }

  return new Response(new Uint8Array(content), {
    headers: { ...baseHeaders, "Content-Length": String(content.length) },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path } = await params;
  const assetPath = path.map(decodeURIComponent).join("/");
  if (!SAFE_ASSET_PATH.test(assetPath)) {
    return new Response("Invalid asset path.", { status: 400 });
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
    where: { courseId_path: { courseId: course.id, path: assetPath } },
  });

  if (asset) {
    return respondWithBytes(Buffer.from(asset.content), asset.mimeType, request.headers.get("range"));
  }

  if (CHUNKED_VIDEO_PATH.test(assetPath)) {
    try {
      const meta = await listChunkedVideoMeta(course.id, assetPath);
      if (!meta.length) return new Response("Asset not found.", { status: 404 });

      const totalBytes = meta.reduce((sum, part) => sum + part.byteLength, 0);
      if (!totalBytes) return new Response("Asset not found.", { status: 404 });

      const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
      const hasRange = Boolean(range);
      const requestedStart = hasRange ? (range![1] ? Number(range![1]) : 0) : 0;
      const requestedEnd = hasRange
        ? range![2]
          ? Number(range![2])
          : totalBytes - 1
        : totalBytes - 1;

      const slice = await loadChunkedVideoSlice(
        course.id,
        assetPath,
        requestedStart,
        requestedEnd,
      );
      if (!slice || !slice.body.length) {
        return new Response("Asset not found.", { status: 404 });
      }

      const mimeType = slice.mimeType.startsWith("video/")
        ? slice.mimeType
        : "video/mp4";

      if (hasRange) {
        return new Response(new Uint8Array(slice.body), {
          status: 206,
          headers: {
            "Content-Type": mimeType,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
            "Content-Length": String(slice.body.length),
            "Content-Range": `bytes ${slice.start}-${slice.end}/${slice.totalBytes}`,
          },
        });
      }

      return new Response(new Uint8Array(slice.body), {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=86400",
          "X-Content-Type-Options": "nosniff",
          "Content-Length": String(slice.totalBytes),
        },
      });
    } catch (error) {
      console.error("Chunked classroom video asset failed:", error);
      return new Response("Video asset could not be loaded.", { status: 500 });
    }
  }

  return new Response("Asset not found.", { status: 404 });
}
