import "server-only";

import { prisma } from "@/lib/prisma";

export function chunkedVideoPartPath(videoAssetPath: string, chunkIndex: number) {
  return `${videoAssetPath}/chunks/${String(chunkIndex).padStart(3, "0")}`;
}

type ChunkMeta = {
  path: string;
  mimeType: string;
  byteLength: number;
};

export async function listChunkedVideoMeta(courseId: number, videoAssetPath: string) {
  const rows = await prisma.$queryRaw<
    Array<{ path: string; mimeType: string; byteLength: bigint | number }>
  >`
    SELECT path, "mimeType", octet_length(content) AS "byteLength"
    FROM "ScormAsset"
    WHERE "courseId" = ${courseId}
      AND path LIKE ${`${videoAssetPath}/chunks/%`}
    ORDER BY path ASC
  `;

  return rows.map((row) => ({
    path: row.path,
    mimeType: row.mimeType,
    byteLength: Number(row.byteLength),
  })) satisfies ChunkMeta[];
}

export async function loadChunkedVideoParts(courseId: number, videoAssetPath: string) {
  return prisma.scormAsset.findMany({
    where: {
      courseId,
      path: { startsWith: `${videoAssetPath}/chunks/` },
    },
    orderBy: { path: "asc" },
    select: { path: true, mimeType: true, content: true },
  });
}

export async function loadChunkedVideoSlice(
  courseId: number,
  videoAssetPath: string,
  start: number,
  end: number,
) {
  const meta = await listChunkedVideoMeta(courseId, videoAssetPath);
  if (!meta.length) return null;

  const totalBytes = meta.reduce((sum, part) => sum + part.byteLength, 0);
  const mimeType = meta[0]?.mimeType || "video/mp4";
  const safeStart = Math.max(0, Math.min(start, totalBytes - 1));
  const safeEnd = Math.max(safeStart, Math.min(end, totalBytes - 1));

  let offset = 0;
  const pathsNeeded: string[] = [];
  for (const part of meta) {
    const partStart = offset;
    const partEnd = offset + part.byteLength - 1;
    if (partEnd >= safeStart && partStart <= safeEnd) pathsNeeded.push(part.path);
    offset += part.byteLength;
  }

  if (!pathsNeeded.length) return null;

  const parts = await prisma.scormAsset.findMany({
    where: { courseId, path: { in: pathsNeeded } },
    orderBy: { path: "asc" },
    select: { path: true, mimeType: true, content: true },
  });

  return {
    body: sliceChunkedParts(parts, safeStart, safeEnd),
    mimeType,
    totalBytes,
    start: safeStart,
    end: safeEnd,
  };
}

export function totalChunkedBytes(
  parts: Array<{ content: Uint8Array | Buffer }>,
): number {
  return parts.reduce((sum, part) => sum + part.content.byteLength, 0);
}

export function sliceChunkedParts(
  parts: Array<{ content: Buffer | Uint8Array }>,
  start: number,
  end: number,
): Buffer {
  const buffers: Buffer[] = [];
  let offset = 0;

  for (const part of parts) {
    const content = Buffer.from(part.content);
    const partStart = offset;
    const partEnd = offset + content.length - 1;
    if (partEnd < start) {
      offset += content.length;
      continue;
    }
    if (partStart > end) break;

    const sliceStart = Math.max(0, start - partStart);
    const sliceEnd = Math.min(content.length - 1, end - partStart);
    buffers.push(content.subarray(sliceStart, sliceEnd + 1));
    offset += content.length;
  }

  return Buffer.concat(buffers);
}
