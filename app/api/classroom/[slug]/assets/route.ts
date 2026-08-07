export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";

const MAX_CHUNK_BYTES = 3 * 1024 * 1024;
const TARGET_PATH = /^(?:classroom\/deck\.pptx|classroom\/slides\/\d+|classroom\/(?:media|activities)\/[a-z0-9-]+|classroom\/chapters\/[1-9]\d*\/(?:deck\.pptx|slides\/\d+))$/;
const UPLOAD_ID = /^[a-f0-9-]{20,50}$/i;
const ALLOWED_MIME = /^(?:image\/(?:png|jpeg|webp)|video\/(?:mp4|webm)|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation)$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    select: {
      id: true,
      sections: { select: { position: true } },
    },
  });
  if (!course) return Response.json({ error: "Course not found." }, { status: 404 });

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json();
    if (body.action !== "complete") {
      return Response.json({ error: "Invalid asset action." }, { status: 400 });
    }

    const requiredPaths = course.sections.flatMap((section) => {
      const base = section.position <= 1
        ? "classroom"
        : `classroom/chapters/${section.position}`;
      // The original deck is the source of truth. Slide images are optional caches
      // generated on demand for AI vision and fallback rendering.
      return [`${base}/deck.pptx`];
    });
    const storedAssets = await prisma.scormAsset.findMany({
      where: { courseId: course.id, path: { in: requiredPaths } },
      select: { path: true },
    });
    const storedPaths = new Set(storedAssets.map((asset) => asset.path));
    const missing = requiredPaths.filter((path) => !storedPaths.has(path));
    if (missing.length) {
      return Response.json(
        { error: `${missing.length} course file${missing.length === 1 ? " is" : "s are"} still missing.` },
        { status: 409 },
      );
    }

    const published = Boolean(body.published);
    await prisma.masonCourse.update({ where: { id: course.id }, data: { published } });
    return Response.json({ complete: true, published });
  }

  const form = await request.formData();
  const targetPath = String(form.get("targetPath") || "");
  const mimeType = String(form.get("mimeType") || "");
  const uploadId = String(form.get("uploadId") || "");
  const chunkIndex = Number(form.get("chunkIndex"));
  const chunkCount = Number(form.get("chunkCount"));
  const chunk = form.get("chunk");

  if (!TARGET_PATH.test(targetPath) || !ALLOWED_MIME.test(mimeType) || !UPLOAD_ID.test(uploadId)) {
    return Response.json({ error: "Invalid course asset upload." }, { status: 400 });
  }
  if (
    !Number.isInteger(chunkIndex) || chunkIndex < 0 ||
    !Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 100 ||
    chunkIndex >= chunkCount || !(chunk instanceof File) || chunk.size > MAX_CHUNK_BYTES
  ) {
    return Response.json({ error: "Invalid course asset chunk." }, { status: 400 });
  }

  const chunkPath = `classroom/uploads/${uploadId}/${String(chunkIndex).padStart(3, "0")}`;
  const chunkContent = Buffer.from(await chunk.arrayBuffer());
  await prisma.scormAsset.upsert({
    where: { courseId_path: { courseId: course.id, path: chunkPath } },
    create: {
      courseId: course.id,
      path: chunkPath,
      mimeType: "application/octet-stream",
      content: chunkContent,
    },
    update: { content: chunkContent },
  });

  if (chunkIndex < chunkCount - 1) {
    return Response.json({ accepted: true, complete: false });
  }

  const chunks = await prisma.scormAsset.findMany({
    where: { courseId: course.id, path: { startsWith: `classroom/uploads/${uploadId}/` } },
    orderBy: { path: "asc" },
  });
  if (chunks.length !== chunkCount) {
    return Response.json({ error: "One or more upload chunks are missing." }, { status: 409 });
  }

  const content = Buffer.concat(chunks.map((item) => Buffer.from(item.content)));
  await prisma.$transaction([
    prisma.scormAsset.upsert({
      where: { courseId_path: { courseId: course.id, path: targetPath } },
      create: { courseId: course.id, path: targetPath, mimeType, content },
      update: { mimeType, content },
    }),
    prisma.scormAsset.deleteMany({
      where: { courseId: course.id, path: { startsWith: `classroom/uploads/${uploadId}/` } },
    }),
  ]);

  return Response.json({ accepted: true, complete: true });
}
