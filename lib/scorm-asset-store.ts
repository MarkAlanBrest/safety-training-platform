import "server-only";

import { prisma } from "@/lib/prisma";

const BLOB_WRITE_TIMEOUT_MS = 120_000;

export async function saveScormAssetBlob(input: {
  courseId: number;
  path: string;
  mimeType: string;
  content: Buffer;
}) {
  const content = new Uint8Array(input.content);
  await prisma.$transaction(
    async (tx) => {
      await tx.scormAsset.upsert({
        where: { courseId_path: { courseId: input.courseId, path: input.path } },
        create: {
          courseId: input.courseId,
          path: input.path,
          mimeType: input.mimeType,
          content,
        },
        update: { mimeType: input.mimeType, content },
      });
    },
    { timeout: BLOB_WRITE_TIMEOUT_MS, maxWait: BLOB_WRITE_TIMEOUT_MS },
  );
}

export async function finalizeStagedAssetUpload(input: {
  courseId: number;
  targetPath: string;
  mimeType: string;
  content: Buffer;
  uploadId: string;
}) {
  const content = new Uint8Array(input.content);
  await prisma.$transaction(
    async (tx) => {
      await tx.scormAsset.upsert({
        where: { courseId_path: { courseId: input.courseId, path: input.targetPath } },
        create: {
          courseId: input.courseId,
          path: input.targetPath,
          mimeType: input.mimeType,
          content,
        },
        update: { mimeType: input.mimeType, content },
      });
      await tx.scormAsset.deleteMany({
        where: {
          courseId: input.courseId,
          path: { startsWith: `classroom/uploads/${input.uploadId}/` },
        },
      });
    },
    { timeout: BLOB_WRITE_TIMEOUT_MS, maxWait: BLOB_WRITE_TIMEOUT_MS },
  );
}
