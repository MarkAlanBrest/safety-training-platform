import "server-only";

import { prisma } from "@/lib/prisma";

const STAGING_SLUG = "_admin-transcribe-staging_";

export function transcribeChunkPath(uploadId: string, chunkIndex: number) {
  return `transcribe/${uploadId}/chunks/${String(chunkIndex).padStart(4, "0")}`;
}

export async function getTranscribeStagingCourseId() {
  const existing = await prisma.masonCourse.findUnique({
    where: { slug: STAGING_SLUG },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.masonCourse.create({
    data: {
      title: "Transcribe staging",
      slug: STAGING_SLUG,
      published: false,
      courseType: "classroom",
    },
    select: { id: true },
  });
  return created.id;
}

export async function saveTranscribeChunk(input: {
  uploadId: string;
  chunkIndex: number;
  mimeType: string;
  content: Buffer;
}) {
  const courseId = await getTranscribeStagingCourseId();
  const path = transcribeChunkPath(input.uploadId, input.chunkIndex);
  const content = new Uint8Array(input.content);

  await prisma.scormAsset.upsert({
    where: { courseId_path: { courseId, path } },
    create: {
      courseId,
      path,
      mimeType: input.mimeType,
      content,
    },
    update: { mimeType: input.mimeType, content },
  });
}

export async function listTranscribeChunks(uploadId: string) {
  const courseId = await getTranscribeStagingCourseId();
  const rows = await prisma.scormAsset.findMany({
    where: {
      courseId,
      path: { startsWith: `transcribe/${uploadId}/chunks/` },
    },
    orderBy: { path: "asc" },
    select: { path: true, content: true },
  });

  return rows.map((row) => ({
    chunkIndex: Number(row.path.split("/").pop() || "0"),
    content: Buffer.from(row.content),
  }));
}

export async function deleteTranscribeUpload(uploadId: string) {
  const courseId = await getTranscribeStagingCourseId();
  await prisma.scormAsset.deleteMany({
    where: {
      courseId,
      path: { startsWith: `transcribe/${uploadId}/` },
    },
  });
}
