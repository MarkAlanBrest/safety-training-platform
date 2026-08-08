import {
  mergeWebVttFiles,
  normalizeWebVtt,
  parseWebVttToSegments,
  segmentsToWebVtt,
} from "@/lib/video-transcription";

const WHISPER_MAX_BYTES = 24 * 1024 * 1024;
const UPLOAD_CHUNK_BYTES = 10 * 1024 * 1024;
const CHUNK_SECONDS = 600;

async function readTranscribeResponse(response: Response) {
  const raw = await response.text();
  let payload: { vtt?: string; error?: string } = {};
  try {
    payload = JSON.parse(raw) as { vtt?: string; error?: string };
  } catch {
    payload = { vtt: raw };
  }

  if (!response.ok) {
    throw new Error(payload.error || "The video audio could not be transcribed.");
  }

  const vtt = normalizeWebVtt(payload.vtt || raw);
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
    const payload = (await response.json()) as { error?: string };
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

  if (videoFile.size > WHISPER_MAX_BYTES || isVideoFile(videoFile)) {
    if (videoFile.size > WHISPER_MAX_BYTES) {
      return uploadVideoForTranscription(videoFile, onProgress);
    }

    onProgress?.("Transcribing on server…");
    try {
      return await transcribeBlob(videoFile, videoFile.name || "media.mp4");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("too large")) {
        throw error;
      }
      return uploadVideoForTranscription(videoFile, onProgress);
    }
  }

  onProgress?.("Transcribing audio…");
  return transcribeBlob(videoFile, videoFile.name || "audio.mp3");
}

export function vttToFile(vtt: string, baseName: string) {
  return new File([vtt], `${baseName}.vtt`, { type: "text/vtt" });
}

// Kept for chunked VTT merge if needed elsewhere.
export { CHUNK_SECONDS, mergeWebVttFiles, parseWebVttToSegments, segmentsToWebVtt };
