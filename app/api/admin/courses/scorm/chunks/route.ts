export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { saveScormAssetBlob } from "@/lib/scorm-asset-store";
import { scormStagingPrefix } from "@/lib/scorm-course-create";

const MAX_CHUNK_BYTES = 3 * 1024 * 1024;
const MAX_CHUNK_COUNT = 700;
const UPLOAD_ID = /^[a-f0-9-]{20,50}$/i;

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const form = await request.formData();
    const slug = String(form.get("slug") || "").trim();
    const uploadId = String(form.get("uploadId") || "");
    const chunkIndex = Number(form.get("chunkIndex"));
    const chunkCount = Number(form.get("chunkCount"));
    const chunk = form.get("chunk");

    if (!slug || !UPLOAD_ID.test(uploadId)) {
      return Response.json({ error: "Invalid SCORM upload." }, { status: 400 });
    }
    if (
      !Number.isInteger(chunkIndex) ||
      chunkIndex < 0 ||
      !Number.isInteger(chunkCount) ||
      chunkCount < 1 ||
      chunkCount > MAX_CHUNK_COUNT ||
      chunkIndex >= chunkCount ||
      !(chunk instanceof File) ||
      chunk.size > MAX_CHUNK_BYTES
    ) {
      return Response.json(
        {
          error:
            chunkCount > MAX_CHUNK_COUNT
              ? "This SCORM package is too large."
              : "Invalid SCORM upload chunk.",
        },
        { status: 400 },
      );
    }

    const course = await prisma.masonCourse.findUnique({
      where: { slug },
      select: { id: true, courseType: true },
    });
    if (!course || course.courseType !== "scorm") {
      return Response.json({ error: "SCORM course not found." }, { status: 404 });
    }

    const chunkPath = `${scormStagingPrefix(uploadId)}${String(chunkIndex).padStart(3, "0")}`;
    await saveScormAssetBlob({
      courseId: course.id,
      path: chunkPath,
      mimeType: "application/octet-stream",
      content: Buffer.from(await chunk.arrayBuffer()),
    });

    return Response.json({ accepted: true, chunkIndex, chunkCount });
  } catch (error) {
    console.error("SCORM chunk upload failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "The SCORM package could not be uploaded." },
      { status: 500 },
    );
  }
}
