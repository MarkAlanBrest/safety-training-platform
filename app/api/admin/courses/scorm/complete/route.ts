export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import {
  deleteStagedScormZip,
  importScormZipIntoCourse,
  readStagedScormZip,
} from "@/lib/scorm-course-create";
import { MAX_SCORM_ZIP_BYTES, maxScormZipMb } from "@/lib/scorm-limits";

type CompleteBody = {
  slug?: string;
  uploadId?: string;
  fileName?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as CompleteBody;
    const slug = String(body.slug || "").trim();
    const uploadId = String(body.uploadId || "").trim();
    const fileName = String(body.fileName || "").trim();

    if (!slug || !uploadId || !fileName) {
      return Response.json({ error: "Missing SCORM upload details." }, { status: 400 });
    }

    const course = await prisma.masonCourse.findUnique({
      where: { slug },
      include: {
        sections: {
          orderBy: { position: "asc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!course || course.courseType !== "scorm") {
      return Response.json({ error: "SCORM course not found." }, { status: 404 });
    }

    const zipBuffer = await readStagedScormZip(course.id, uploadId);
    if (zipBuffer.byteLength > MAX_SCORM_ZIP_BYTES) {
      await deleteStagedScormZip(course.id, uploadId);
      return Response.json(
        { error: `SCORM ZIP uploads are limited to ${maxScormZipMb()} MB.` },
        { status: 400 },
      );
    }

    const parsed = await importScormZipIntoCourse(course.id, new Uint8Array(zipBuffer));
    await deleteStagedScormZip(course.id, uploadId);

    if (course.sections[0]) {
      await prisma.masonSection.update({
        where: { id: course.sections[0].id },
        data: { fileName },
      });
    }

    const updated = await prisma.masonCourse.findUnique({ where: { id: course.id } });
    return Response.json({
      course: updated,
      assetCount: parsed.assets.length,
    });
  } catch (error) {
    console.error("SCORM import failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "The SCORM package could not be imported." },
      { status: 400 },
    );
  }
}
