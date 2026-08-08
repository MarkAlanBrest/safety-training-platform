import {
  mergeWebVttFiles,
  normalizeWebVtt,
  parseWebVttToSegments,
  segmentsToWebVtt,
} from "@/lib/video-transcription";
import { parseJsonResponse } from "@/lib/parse-response";

const WHISPER_MAX_BYTES = 24 * 1024 * 1024;
const UPLOAD_CHUNK_BYTES = 768 * 1024;
const CHUNK_SECONDS = 600;

async function readTranscribeResponse(response: Response) {
  const payload = await parseJsonResponse<{ vtt?: string; error?: string }>(response);

  if (!response.ok) {
    throw new Error(payload.error || "The video audio could not be transcribed.");
  }

  const vtt = normalizeWebVtt(payload.vtt || "");
  if (!parseWebVttToSegments(vtt).length) {
    throw new Error("No transcript was returned for this video.");
  }
  return vtt;
}

async function transcribeBlob(file: Blob, fileName: string) {
  const form = new FormData();
  form.append("file", file, fileName);
  const response = await fetch("/api/admin/transcribe-video", {
    method: "POST",
    body: form,
  });
  return readTranscribeResponse(response);
}

async function uploadVideoForTranscription(
  videoFile: File,
  onProgress?: (message: string) => void,
) {
  const uploadId = crypto.randomUUID();
  const chunkCount = Math.max(1, Math.ceil(videoFile.size / UPLOAD_CHUNK_BYTES));
  const extension = videoFile.name.split(".").pop()?.toLowerCase() || "mp4";

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    onProgress?.(`Uploading video… ${chunkIndex + 1}/${chunkCount}`);
    const start = chunkIndex * UPLOAD_CHUNK_BYTES;
    const chunk = videoFile.slice(start, Math.min(videoFile.size, start + UPLOAD_CHUNK_BYTES));
    const form = new FormData();
    form.set("uploadId", uploadId);
    form.set("chunkIndex", String(chunkIndex));
    form.set("chunkCount", String(chunkCount));
    form.set("chunk", chunk, `chunk-${chunkIndex}`);

    const response = await fetch("/api/admin/transcribe-video/chunks", {
      method: "POST",
      body: form,
    });
    const payload = await parseJsonResponse<{ error?: string }>(response);
    if (!response.ok) {
      throw new Error(payload.error || "The video could not be uploaded for transcription.");
    }
  }

  onProgress?.("Transcribing on server…");
  const response = await fetch("/api/admin/transcribe-video/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, chunkCount, extension }),
  });
  return readTranscribeResponse(response);
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);
}

export async function transcribeVideoFile(
  videoFile: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  onProgress?.("Preparing video…");

  if (isVideoFile(videoFile)) {
    return uploadVideoForTranscription(videoFile, onProgress);
  }

  if (videoFile.size <= WHISPER_MAX_BYTES) {
    onProgress?.("Transcribing audio…");
    return transcribeBlob(videoFile, videoFile.name || "audio.mp3");
  }

  return uploadVideoForTranscription(videoFile, onProgress);
}

export function vttToFile(vtt: string, baseName: string) {
  return new File([vtt], `${baseName}.vtt`, { type: "text/vtt" });
}

export { CHUNK_SECONDS, mergeWebVttFiles, parseWebVttToSegments, segmentsToWebVtt };
