import "server-only";

import { prisma } from "@/lib/prisma";

export function chunkedVideoPartPath(videoAssetPath: string, chunkIndex: number) {
  return `${videoAssetPath}/chunks/${String(chunkIndex).padStart(3, "0")}`;
}

export type ChunkedVideoPart = {
  path: string;
  mimeType: string;
  content: Buffer | Uint8Array;
  globalStart: number;
};

type ChunkMeta = {
  path: string;
  mimeType: string;
  byteLength: number;
  globalStart: number;
};

function buildChunkMeta(rows: Array<{ path: string; mimeType: string; byteLength: number }>) {
  let globalStart = 0;
  return rows.map((row) => {
    const meta = {
      path: row.path,
      mimeType: row.mimeType,
      byteLength: row.byteLength,
      globalStart,
    };
    globalStart += row.byteLength;
    return meta;
  });
}

export async function listChunkedVideoMeta(courseId: number, videoAssetPath: string) {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ path: string; mimeType: string; byteLength: bigint | number }>
    >`
      SELECT path, "mimeType", octet_length(content) AS "byteLength"
      FROM "ScormAsset"
      WHERE "courseId" = ${courseId}
        AND path LIKE ${`${videoAssetPath}/chunks/%`}
      ORDER BY path ASC
    `;

    return buildChunkMeta(
      rows.map((row) => ({
        path: row.path,
        mimeType: row.mimeType,
        byteLength: Number(row.byteLength),
      })),
    );
  } catch (error) {
    console.error("Chunked video metadata query failed, falling back to Prisma:", error);
    const parts = await prisma.scormAsset.findMany({
      where: {
        courseId,
        path: { startsWith: `${videoAssetPath}/chunks/` },
      },
      orderBy: { path: "asc" },
      select: { path: true, mimeType: true, content: true },
    });

    return buildChunkMeta(
      parts.map((part) => ({
        path: part.path,
        mimeType: part.mimeType,
        byteLength: part.content.byteLength,
      })),
    );
  }
}

export async function loadChunkedVideoParts(courseId: number, videoAssetPath: string) {
  const meta = await listChunkedVideoMeta(courseId, videoAssetPath);
  if (!meta.length) return [];

  const parts = await prisma.scormAsset.findMany({
    where: { courseId, path: { in: meta.map((part) => part.path) } },
    orderBy: { path: "asc" },
    select: { path: true, mimeType: true, content: true },
  });
  const partByPath = new Map(parts.map((part) => [part.path, part]));

  return meta.flatMap((entry) => {
    const part = partByPath.get(entry.path);
    if (!part) return [];
    return [
      {
        path: part.path,
        mimeType: part.mimeType,
        content: Buffer.from(part.content),
        globalStart: entry.globalStart,
      },
    ];
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
  const safeStart = Math.max(0, Math.min(start, Math.max(totalBytes - 1, 0)));
  const safeEnd = Math.max(safeStart, Math.min(end, Math.max(totalBytes - 1, 0)));

  const pathsNeeded = meta
    .filter((part) => {
      const partEnd = part.globalStart + part.byteLength - 1;
      return partEnd >= safeStart && part.globalStart <= safeEnd;
    })
    .map((part) => part.path);

  if (!pathsNeeded.length) return null;

  const parts = await prisma.scormAsset.findMany({
    where: { courseId, path: { in: pathsNeeded } },
    orderBy: { path: "asc" },
    select: { path: true, mimeType: true, content: true },
  });
  const partByPath = new Map(parts.map((part) => [part.path, part]));

  const positionedParts: ChunkedVideoPart[] = meta.flatMap((entry) => {
    if (!pathsNeeded.includes(entry.path)) return [];
    const part = partByPath.get(entry.path);
    if (!part) return [];
    return [
      {
        path: part.path,
        mimeType: part.mimeType,
        content: Buffer.from(part.content),
        globalStart: entry.globalStart,
      },
    ];
  });

  if (!positionedParts.length) return null;

  return {
    body: sliceChunkedParts(positionedParts, safeStart, safeEnd),
    mimeType,
    totalBytes,
    start: safeStart,
    end: safeEnd,
  };
}

export function totalChunkedBytes(parts: Array<{ content: Uint8Array | Buffer }>) {
  return parts.reduce((sum, part) => sum + part.content.byteLength, 0);
}

export function sliceChunkedParts(
  parts: Array<{ content: Buffer | Uint8Array; globalStart: number }>,
  start: number,
  end: number,
): Buffer {
  const buffers: Buffer[] = [];

  for (const part of parts) {
    const content = Buffer.from(part.content);
    const partStart = part.globalStart;
    const partEnd = partStart + content.length - 1;
    if (partEnd < start) continue;
    if (partStart > end) break;

    const sliceStart = Math.max(0, start - partStart);
    const sliceEnd = Math.min(content.length - 1, end - partStart);
    buffers.push(content.subarray(sliceStart, sliceEnd + 1));
  }

  return Buffer.concat(buffers);
}
