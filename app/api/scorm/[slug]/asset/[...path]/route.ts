export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path } = await params;
  const assetPath = path.map(decodeURIComponent).join("/");
  if (!assetPath || assetPath.includes("..")) return new Response("Invalid asset path.", { status: 400 });

  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    select: { id: true, published: true, courseType: true },
  });
  if (!course || course.courseType !== "scorm" || !course.published) {
    return new Response("Course not found.", { status: 404 });
  }
  const asset = await prisma.scormAsset.findUnique({
    where: { courseId_path: { courseId: course.id, path: assetPath } },
  });
  if (!asset) return new Response("Asset not found.", { status: 404 });

  return new Response(asset.content, {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
