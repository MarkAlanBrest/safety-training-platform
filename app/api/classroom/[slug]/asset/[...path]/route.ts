export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";
import { readScormAssetContent } from "@/lib/scorm-asset-store";

const SAFE_ASSET_PATH = /^classroom\/(?:media|activities)\/[a-z0-9-]+(?:\.vtt)?$/;

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
    select: { mimeType: true },
  });

  if (!asset) {
    return new Response("Asset not found.", { status: 404 });
  }

  try {
    const content = await readScormAssetContent(course.id, assetPath);
    return respondWithBytes(content, asset.mimeType, request.headers.get("range"));
  } catch {
    return new Response("Asset not found.", { status: 404 });
  }
}
