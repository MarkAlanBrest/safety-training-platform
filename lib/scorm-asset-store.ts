import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const BLOB_WRITE_TIMEOUT_MS = 120_000;
const EMPTY = new Uint8Array(0);

/** Local-on-disk asset root. Blobs stay out of Postgres for now. */
export function uploadsRoot() {
  return process.env.COURSE_UPLOADS_DIR || path.join(process.cwd(), "data", "uploads");
}

function assertSafeAssetPath(assetPath: string) {
  if (!assetPath || assetPath.includes("\0") || assetPath.includes("..")) {
    throw new Error("Invalid asset path.");
  }
  if (path.isAbsolute(assetPath) || assetPath.startsWith("/") || assetPath.startsWith("\\")) {
    throw new Error("Invalid asset path.");
  }
}

export function localAssetAbsPath(courseId: number, assetPath: string) {
  assertSafeAssetPath(assetPath);
  const root = path.resolve(uploadsRoot(), String(courseId));
  const abs = path.resolve(root, assetPath);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error("Invalid asset path.");
  }
  return abs;
}

async function writeLocalAsset(courseId: number, assetPath: string, content: Buffer | Uint8Array) {
  const abs = localAssetAbsPath(courseId, assetPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content);
}

async function readLocalAsset(courseId: number, assetPath: string) {
  const abs = localAssetAbsPath(courseId, assetPath);
  return readFile(abs);
}

async function deleteLocalAssetTree(courseId: number, assetPathPrefix?: string) {
  if (!assetPathPrefix) {
    await rm(path.resolve(uploadsRoot(), String(courseId)), { recursive: true, force: true });
    return;
  }
  assertSafeAssetPath(assetPathPrefix.endsWith("/") ? assetPathPrefix.slice(0, -1) : assetPathPrefix);
  const abs = localAssetAbsPath(
    courseId,
    assetPathPrefix.endsWith("/") ? assetPathPrefix.slice(0, -1) : assetPathPrefix,
  );
  await rm(abs, { recursive: true, force: true });
}

export async function saveScormAssetBlob(input: {
  courseId: number;
  path: string;
  mimeType: string;
  content: Buffer;
}) {
  await writeLocalAsset(input.courseId, input.path, input.content);
  await prisma.scormAsset.upsert({
    where: { courseId_path: { courseId: input.courseId, path: input.path } },
    create: {
      courseId: input.courseId,
      path: input.path,
      mimeType: input.mimeType,
      content: EMPTY,
    },
    update: { mimeType: input.mimeType, content: EMPTY },
  });
}

export async function replaceCourseAssetBlobs(
  courseId: number,
  assets: Array<{ path: string; mimeType: string; content: Buffer | Uint8Array }>,
) {
  await deleteLocalAssetTree(courseId);
  await prisma.$transaction(
    async (tx) => {
      await tx.scormAsset.deleteMany({ where: { courseId } });
      if (!assets.length) return;
      for (const asset of assets) {
        await writeLocalAsset(courseId, asset.path, asset.content);
      }
      await tx.scormAsset.createMany({
        data: assets.map((asset) => ({
          courseId,
          path: asset.path,
          mimeType: asset.mimeType,
          content: EMPTY,
        })),
      });
    },
    { timeout: BLOB_WRITE_TIMEOUT_MS, maxWait: BLOB_WRITE_TIMEOUT_MS },
  );
}

export async function readScormAssetContent(courseId: number, assetPath: string) {
  try {
    return await readLocalAsset(courseId, assetPath);
  } catch {
    const row = await prisma.scormAsset.findUnique({
      where: { courseId_path: { courseId, path: assetPath } },
      select: { content: true },
    });
    if (!row?.content?.length) {
      throw new Error("Asset content not found.");
    }
    return Buffer.from(row.content);
  }
}

export async function readScormAssetsWithPrefix(courseId: number, prefix: string) {
  const rows = await prisma.scormAsset.findMany({
    where: { courseId, path: { startsWith: prefix } },
    orderBy: { path: "asc" },
    select: { path: true, mimeType: true },
  });
  const out: Array<{ path: string; mimeType: string; content: Buffer }> = [];
  for (const row of rows) {
    out.push({
      path: row.path,
      mimeType: row.mimeType,
      content: await readScormAssetContent(courseId, row.path),
    });
  }
  return out;
}

export async function deleteScormAssetsForCourse(courseId: number, pathPrefix?: string) {
  if (pathPrefix) {
    await deleteLocalAssetTree(courseId, pathPrefix);
    await prisma.scormAsset.deleteMany({
      where: { courseId, path: { startsWith: pathPrefix } },
    });
    return;
  }
  await deleteLocalAssetTree(courseId);
  await prisma.scormAsset.deleteMany({ where: { courseId } });
}

export async function finalizeStagedAssetUpload(input: {
  courseId: number;
  targetPath: string;
  mimeType: string;
  content: Buffer;
  uploadId: string;
}) {
  await writeLocalAsset(input.courseId, input.targetPath, input.content);
  await prisma.$transaction(
    async (tx) => {
      await tx.scormAsset.upsert({
        where: { courseId_path: { courseId: input.courseId, path: input.targetPath } },
        create: {
          courseId: input.courseId,
          path: input.targetPath,
          mimeType: input.mimeType,
          content: EMPTY,
        },
        update: { mimeType: input.mimeType, content: EMPTY },
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
  await deleteLocalAssetTree(input.courseId, `classroom/uploads/${input.uploadId}`);
}
