export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { requireAdmin } from "@/lib/admin-session";
import { normalizeWebVtt, parseWebVttToSegments } from "@/lib/video-transcription";

const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;

function openAiErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    return parsed.error?.message?.trim() || raw;
  } catch {
    return raw.trim();
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured for video transcription." },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Upload an audio or video file to transcribe." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          error:
            "This audio file is too large to transcribe in one pass. Try a shorter video or upload a .vtt script instead.",
        },
        { status: 400 },
      );
    }

    const mimeType = file.type || "application/octet-stream";
    if (
      !mimeType.startsWith("audio/") &&
      !mimeType.startsWith("video/") &&
      mimeType !== "application/octet-stream"
    ) {
      return Response.json({ error: "Unsupported file type for transcription." }, { status: 400 });
    }

    const body = new FormData();
    const extension = file.name?.split(".").pop()?.toLowerCase();
    const fallbackName =
      mimeType.startsWith("video/") || extension === "mp4" || extension === "webm"
        ? "media.mp4"
        : "audio.mp3";
    body.append("file", file, file.name || fallbackName);
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
      console.error("Video transcription failed:", detail);
      return Response.json(
        {
          error: detail.includes("OPENAI")
            ? detail
            : `Transcription failed: ${detail}`,
        },
        { status: response.status },
      );
    }

    const vtt = normalizeWebVtt(responseText);
    if (!parseWebVttToSegments(vtt).length) {
      return Response.json(
        { error: "No spoken audio was detected in this video." },
        { status: 422 },
      );
    }

    return Response.json({ vtt });
  } catch (error) {
    console.error("Transcribe video route failed:", error);
    return Response.json(
      { error: "The video could not be transcribed right now." },
      { status: 500 },
    );
  }
}
