import {
  mergeWebVttFiles,
  normalizeWebVtt,
  parseWebVttToSegments,
  segmentsToWebVtt,
} from "@/lib/video-transcription";

const WHISPER_MAX_BYTES = 24 * 1024 * 1024;
const FFMPEG_CORE_VERSION = "0.12.10";
const CHUNK_SECONDS = 600;

type FFmpegInstance = {
  loaded: boolean;
  load: (options: {
    coreURL: string;
    wasmURL: string;
  }) => Promise<void>;
  writeFile: (name: string, data: Uint8Array) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array>;
  exec: (args: string[]) => Promise<void>;
  deleteFile: (name: string) => Promise<void>;
};

let ffmpegPromise: Promise<FFmpegInstance> | null = null;

async function getFfmpeg(onProgress?: (message: string) => void) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      onProgress?.("Loading audio tools…");
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg() as unknown as FFmpegInstance;
      const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@${FFMPEG_CORE_VERSION}/dist/esm`;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
}

async function blobToUint8Array(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

async function extractAudioMp3(videoFile: File, onProgress?: (message: string) => void) {
  onProgress?.("Extracting audio from video…");
  const ffmpeg = await getFfmpeg(onProgress);
  const inputName = videoFile.name.toLowerCase().endsWith(".webm") ? "input.webm" : "input.mp4";
  await ffmpeg.writeFile(inputName, await blobToUint8Array(videoFile));
  await ffmpeg.exec([
    "-i",
    inputName,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "64k",
    "audio.mp3",
  ]);
  const audioBytes = await ffmpeg.readFile("audio.mp3");
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile("audio.mp3");
  return new Blob([audioBytes.slice()], { type: "audio/mpeg" });
}

async function splitAudioMp3(audio: Blob, onProgress?: (message: string) => void) {
  onProgress?.("Preparing long audio for transcription…");
  const ffmpeg = await getFfmpeg(onProgress);
  await ffmpeg.writeFile("audio.mp3", await blobToUint8Array(audio));
  await ffmpeg.exec([
    "-i",
    "audio.mp3",
    "-f",
    "segment",
    "-segment_time",
    String(CHUNK_SECONDS),
    "-c",
    "copy",
    "chunk%03d.mp3",
  ]);
  await ffmpeg.deleteFile("audio.mp3");

  const chunks: Blob[] = [];
  for (let index = 0; index < 24; index += 1) {
    const name = `chunk${String(index).padStart(3, "0")}.mp3`;
    try {
      const bytes = await ffmpeg.readFile(name);
      if (!bytes.byteLength) break;
      chunks.push(new Blob([bytes.slice()], { type: "audio/mpeg" }));
      await ffmpeg.deleteFile(name);
    } catch {
      break;
    }
  }

  return chunks;
}

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
  if (!vtt) {
    throw new Error("No transcript was returned for this video.");
  }
  return vtt;
}

async function transcribeBlob(audio: Blob, fileName: string) {
  const form = new FormData();
  form.append("file", audio, fileName);
  const response = await fetch("/api/admin/transcribe-video", {
    method: "POST",
    body: form,
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
  onProgress?.("Preparing audio…");

  let audio: Blob;
  let uploadName = "audio.mp3";

  if (videoFile.type.startsWith("audio/") || videoFile.name.match(/\.(mp3|m4a|wav)$/i)) {
    audio = videoFile;
    uploadName = videoFile.name || "audio.mp3";
  } else if (isVideoFile(videoFile) && videoFile.size <= WHISPER_MAX_BYTES) {
    onProgress?.("Sending video for transcription…");
    return transcribeBlob(videoFile, videoFile.name || "media.mp4");
  } else {
    try {
      audio = await extractAudioMp3(videoFile, onProgress);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Audio extraction failed.";
      throw new Error(
        `${message} If this keeps failing, upload a .vtt script file instead.`,
      );
    }
  }

  if (audio.size <= WHISPER_MAX_BYTES) {
    onProgress?.("Transcribing audio…");
    return transcribeBlob(audio, uploadName);
  }

  const chunks = await splitAudioMp3(audio, onProgress);
  if (!chunks.length) {
    throw new Error("Could not prepare audio for transcription.");
  }

  const parts: string[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    onProgress?.(`Transcribing part ${index + 1} of ${chunks.length}…`);
    const vtt = await transcribeBlob(chunks[index], `part-${index + 1}.mp3`);
    const offsetSeconds = index * CHUNK_SECONDS;
    const shifted = segmentsToWebVtt(
      parseWebVttToSegments(vtt).map((segment) => ({
        ...segment,
        start: segment.start + offsetSeconds,
        end: segment.end + offsetSeconds,
      })),
    );
    parts.push(shifted);
  }

  return mergeWebVttFiles(parts);
}

export function vttToFile(vtt: string, baseName: string) {
  return new File([vtt], `${baseName}.vtt`, { type: "text/vtt" });
}
