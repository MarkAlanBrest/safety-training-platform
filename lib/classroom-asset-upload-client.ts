"use client";

import { parseJsonResponse } from "@/lib/parse-response";

const CHUNK_BYTES = 2.75 * 1024 * 1024;

export async function uploadClassroomAsset(
  slug: string,
  targetPath: string,
  source: Blob,
  mimeType: string,
) {
  const uploadId = crypto.randomUUID();
  const chunkCount = Math.max(1, Math.ceil(source.size / CHUNK_BYTES));

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_BYTES;
    const chunk = source.slice(start, Math.min(source.size, start + CHUNK_BYTES));
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
