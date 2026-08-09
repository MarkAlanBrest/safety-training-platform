export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";
import { readScormAssetContent } from "@/lib/scorm-asset-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path } = await params;
  const assetPath = path.map(decodeURIComponent).join("/");
  if (!assetPath || assetPath.includes("..")) return new Response("Invalid asset path.", { status: 400 });

  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    select: { id: true, published: true, courseType: true },
  });
  const admin = course && !course.published ? await getAdminSession(request) : null;
  if (!course || course.courseType !== "scorm" || (!course.published && !admin)) {
    return new Response("Course not found.", { status: 404 });
  }
  const asset = await prisma.scormAsset.findUnique({
    where: { courseId_path: { courseId: course.id, path: assetPath } },
    select: { mimeType: true },
  });
  if (!asset) return new Response("Asset not found.", { status: 404 });

  try {
    const content = await readScormAssetContent(course.id, assetPath);
    return new Response(content, {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Asset not found.", { status: 404 });
  }
}
