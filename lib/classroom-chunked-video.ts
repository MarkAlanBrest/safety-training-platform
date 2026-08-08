import "server-only";

import { prisma } from "@/lib/prisma";

export function chunkedVideoPartPath(videoAssetPath: string, chunkIndex: number) {
  return `${videoAssetPath}/chunks/${String(chunkIndex).padStart(3, "0")}`;
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
