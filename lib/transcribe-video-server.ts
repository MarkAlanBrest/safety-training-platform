import "server-only";

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import {
  mergeWebVttFiles,
  normalizeWebVtt,
  parseWebVttToSegments,
  segmentsToWebVtt,
} from "@/lib/video-transcription";
import {
  deleteTranscribeUpload,
  listTranscribeChunks,
} from "@/lib/transcribe-staging";

const WHISPER_MAX_BYTES = 24 * 1024 * 1024;
const CHUNK_SECONDS = 600;

function openAiErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    return parsed.error?.message?.trim() || raw;
  } catch {
    return raw.trim();
  }
}

async function runFfmpeg(args: string[]) {
  const ffmpegPath = ffmpegStatic;
  if (!ffmpegPath) {
    throw new Error("ffmpeg is not available on this server.");
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

async function whisperTranscribeFile(filePath: string, fileName: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for video transcription.");
  }

  const bytes = await readFile(filePath);
  if (bytes.byteLength > WHISPER_MAX_BYTES) {
    throw new Error("Prepared audio chunk is too large to transcribe.");
  }

  const body = new FormData();
  body.append("file", new Blob([bytes]), fileName);
  body.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
  body.append("response_format", "vtt");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });

  const responseText = await response.text();
  if (!response.ok) {
    const detail = openAiErrorMessage(responseText);
    throw new Error(detail || "Transcription failed.");
  }

  const vtt = normalizeWebVtt(responseText);
  if (!parseWebVttToSegments(vtt).length) {
    throw new Error("No spoken audio was detected in this video.");
  }
  return vtt;
}

async function assembleUploadToFile(uploadId: string, targetPath: string, chunkCount: number) {
  const chunks = await listTranscribeChunks(uploadId);
  if (chunks.length !== chunkCount) {
    throw new Error("The video upload is incomplete. Try generating the transcript again.");
  }

  const stream = createWriteStream(targetPath);
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = chunks.find((item) => item.chunkIndex === index);
    if (!chunk) {
      throw new Error("The video upload is incomplete. Try generating the transcript again.");
    }
    await new Promise<void>((resolve, reject) => {
      stream.write(chunk.content, (error) => (error ? reject(error) : resolve()));
    });
  }

  await new Promise<void>((resolve, reject) => {
    stream.end((error: Error | null | undefined) => (error ? reject(error) : resolve()));
  });
}

async function transcribeMediaFile(mediaPath: string, extension: string) {
  const workDir = await mkdtemp(join(tmpdir(), "transcribe-"));
  const audioPath = join(workDir, "audio.mp3");

  try {
    await runFfmpeg([
      "-y",
      "-i",
      mediaPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      audioPath,
    ]);

    const audioBytes = await readFile(audioPath);
    if (audioBytes.byteLength <= WHISPER_MAX_BYTES) {
      return whisperTranscribeFile(audioPath, "audio.mp3");
    }

    const chunkDir = join(workDir, "chunks");
    await mkdir(chunkDir, { recursive: true });
    await runFfmpeg([
      "-y",
      "-i",
      audioPath,
      "-f",
      "segment",
      "-segment_time",
      String(CHUNK_SECONDS),
      "-c",
      "copy",
      join(chunkDir, "chunk%03d.mp3"),
    ]);

    const parts: string[] = [];
    for (let index = 0; index < 48; index += 1) {
      const chunkPath = join(chunkDir, `chunk${String(index).padStart(3, "0")}.mp3`);
      try {
        const chunkBytes = await readFile(chunkPath);
        if (!chunkBytes.byteLength) break;
        const vtt = await whisperTranscribeFile(chunkPath, `part-${index + 1}.mp3`);
        const offsetSeconds = index * CHUNK_SECONDS;
        parts.push(
          segmentsToWebVtt(
            parseWebVttToSegments(vtt).map((segment) => ({
              ...segment,
              start: segment.start + offsetSeconds,
              end: segment.end + offsetSeconds,
            })),
          ),
        );
      } catch (error) {
        if (index === 0) throw error;
        break;
      }
    }

    if (!parts.length) {
      throw new Error("Could not transcribe the extracted audio.");
    }
    return mergeWebVttFiles(parts);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function transcribeUploadedVideo(input: {
  uploadId: string;
  chunkCount: number;
  extension: string;
}) {
  const workDir = await mkdtemp(join(tmpdir(), "transcribe-video-"));
  const mediaPath = join(workDir, `source.${input.extension || "mp4"}`);

  try {
    await assembleUploadToFile(input.uploadId, mediaPath, input.chunkCount);
    return await transcribeMediaFile(mediaPath, input.extension || "mp4");
  } finally {
    await deleteTranscribeUpload(input.uploadId);
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function transcribeDirectUpload(file: File) {
  const workDir = await mkdtemp(join(tmpdir(), "transcribe-direct-"));
  const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const mediaPath = join(workDir, `source.${extension}`);

  try {
    await writeFile(mediaPath, Buffer.from(await file.arrayBuffer()));
    return await transcribeMediaFile(mediaPath, extension);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
