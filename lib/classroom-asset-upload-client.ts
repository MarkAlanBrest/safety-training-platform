"use client";

import { parseJsonResponse } from "@/lib/parse-response";

const CHUNK_BYTES = 768 * 1024;
const MAX_CHUNK_COUNT = 700;
const MAX_RETRIES = 3;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function uploadChunkWithRetry(
  slug: string,
  targetPath: string,
  mimeType: string,
  uploadId: string,
  chunkIndex: number,
  chunkCount: number,
  chunk: Blob,
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const form = new FormData();
      form.set("targetPath", targetPath);
      form.set("mimeType", mimeType);
      form.set("uploadId", uploadId);
      form.set("chunkIndex", String(chunkIndex));
      form.set("chunkCount", String(chunkCount));
      form.set("chunk", chunk, `chunk-${chunkIndex}`);

      const response = await fetch(`/api/classroom/${encodeURIComponent(slug)}/assets`, {
        method: "POST",
        body: form,
      });
      const result = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "A course file could not be uploaded.");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Upload failed.");
      if (lastError.message === "Failed to fetch") {
        lastError = new Error(
          "Upload interrupted — check your connection. Try a smaller video (under 200 MB) or compress to 1080p.",
        );
      }
      if (attempt < MAX_RETRIES - 1) {
        await wait(1000 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error("A course file could not be uploaded.");
}

export async function uploadClassroomAsset(
  slug: string,
  targetPath: string,
  source: Blob,
  mimeType: string,
  onProgress?: (uploadedChunks: number, totalChunks: number) => void,
) {
  const chunkCount = Math.max(1, Math.ceil(source.size / CHUNK_BYTES));
  if (chunkCount > MAX_CHUNK_COUNT) {
    throw new Error(
      `This file is too large (${(source.size / (1024 * 1024)).toFixed(0)} MB). Compress the video or split it into shorter chapters.`,
    );
  }

  const uploadId = crypto.randomUUID();
  const useChunkedVideo = mimeType.startsWith("video/");

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_BYTES;
    const chunk = source.slice(start, Math.min(source.size, start + CHUNK_BYTES));
    const chunkTargetPath = useChunkedVideo
      ? `${targetPath}/chunks/${String(chunkIndex).padStart(3, "0")}`
      : targetPath;

    await uploadChunkWithRetry(
      slug,
      chunkTargetPath,
      mimeType,
      uploadId,
      useChunkedVideo ? 0 : chunkIndex,
      useChunkedVideo ? 1 : chunkCount,
      chunk,
    );
    onProgress?.(chunkIndex + 1, chunkCount);
  }
}

export async function completeClassroomAssetUpload(slug: string, published: boolean) {
  const response = await fetch(`/api/classroom/${encodeURIComponent(slug)}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", published }),
  });
  const result = await parseJsonResponse<{ error?: string }>(response);
  if (!response.ok) throw new Error(result.error || "The course upload could not be completed.");
}
