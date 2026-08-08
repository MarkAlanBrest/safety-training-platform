"use client";

import { parseJsonResponse } from "@/lib/parse-response";

const CHUNK_BYTES = 768 * 1024;
const MAX_CHUNK_COUNT = 700;
const MAX_RETRIES = 3;
export const MAX_SCORM_ZIP_BYTES = 25 * 1024 * 1024;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export type ScormCourseInitPayload = {
  title: string;
  description?: string;
  audience?: string;
  theme?: string;
  estimatedMinutes?: number;
  voiceProvider?: string;
  voice?: string;
  fileName: string;
};

async function uploadChunkWithRetry(
  slug: string,
  uploadId: string,
  chunkIndex: number,
  chunkCount: number,
  chunk: Blob,
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("uploadId", uploadId);
      form.set("chunkIndex", String(chunkIndex));
      form.set("chunkCount", String(chunkCount));
      form.set("chunk", chunk, `chunk-${chunkIndex}`);

      const response = await fetch("/api/admin/courses/scorm/chunks", {
        method: "POST",
        body: form,
      });
      const result = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "The SCORM package could not be uploaded.");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Upload failed.");
      if (lastError.message === "Failed to fetch") {
        lastError = new Error("Upload interrupted — check your connection and try again.");
      }
      if (attempt < MAX_RETRIES - 1) {
        await wait(1000 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error("The SCORM package could not be uploaded.");
}

export async function initScormCourse(input: ScormCourseInitPayload) {
  const response = await fetch("/api/admin/courses/scorm/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJsonResponse<{
    course?: { slug: string };
    uploadId?: string;
    error?: string;
  }>(response);
  if (!response.ok || !payload.course?.slug || !payload.uploadId) {
    throw new Error(payload.error || "The SCORM course could not be created.");
  }
  return { slug: payload.course.slug, uploadId: payload.uploadId };
}

export async function uploadScormZip(
  slug: string,
  uploadId: string,
  file: File,
  onProgress?: (uploadedChunks: number, totalChunks: number) => void,
) {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("SCORM packages must be uploaded as ZIP files.");
  }
  if (file.size > MAX_SCORM_ZIP_BYTES) {
    throw new Error(
      `SCORM ZIP files must be ${Math.floor(MAX_SCORM_ZIP_BYTES / (1024 * 1024))} MB or smaller.`,
    );
  }

  const chunkCount = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
  if (chunkCount > MAX_CHUNK_COUNT) {
    throw new Error("This SCORM package is too large. Try compressing the ZIP file.");
  }

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_BYTES;
    const chunk = file.slice(start, Math.min(file.size, start + CHUNK_BYTES));
    await uploadChunkWithRetry(slug, uploadId, chunkIndex, chunkCount, chunk);
    onProgress?.(chunkIndex + 1, chunkCount);
  }
}

export async function completeScormUpload(slug: string, uploadId: string, fileName: string) {
  const response = await fetch("/api/admin/courses/scorm/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, uploadId, fileName }),
  });
  const payload = await parseJsonResponse<{
    course?: { slug: string };
    assetCount?: number;
    error?: string;
  }>(response);
  if (!response.ok || !payload.course?.slug) {
    throw new Error(payload.error || "The SCORM package could not be imported.");
  }
  return payload;
}

export async function createScormCourseFromZip(
  input: ScormCourseInitPayload,
  file: File,
  onProgress?: (uploadedChunks: number, totalChunks: number) => void,
) {
  const { slug, uploadId } = await initScormCourse(input);
  await uploadScormZip(slug, uploadId, file, onProgress);
  return completeScormUpload(slug, uploadId, file.name);
}
