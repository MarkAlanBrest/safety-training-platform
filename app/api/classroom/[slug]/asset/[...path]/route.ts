export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";

const SAFE_ASSET_PATH = /^classroom\/(?:media|activities)\/[a-z0-9-]+$/;

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
  if (!asset) return new Response("Asset not found.", { status: 404 });

  const content = Buffer.from(asset.content);
  const baseHeaders = {
    "Content-Type": asset.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);

  if (range && content.length) {
    const requestedStart = range[1] ? Number(range[1]) : 0;
    const requestedEnd = range[2] ? Number(range[2]) : content.length - 1;
    const start = Math.max(0, Math.min(requestedStart, content.length - 1));
    const end = Math.max(start, Math.min(requestedEnd, content.length - 1));
    const chunk = content.subarray(start, end + 1);

    return new Response(chunk, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${content.length}`,
      },
    });
  }

  return new Response(content, {
    headers: { ...baseHeaders, "Content-Length": String(content.length) },
  });
}
