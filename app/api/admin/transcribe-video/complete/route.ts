export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { requireAdmin } from "@/lib/admin-session";
import { transcribeUploadedVideo } from "@/lib/transcribe-video-server";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const uploadId = String(body.uploadId || "").trim();
    const chunkCount = Number(body.chunkCount);
    const extension = String(body.extension || "mp4")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (!uploadId || !Number.isInteger(chunkCount) || chunkCount < 1) {
      return Response.json({ error: "Upload metadata is incomplete." }, { status: 400 });
    }

    const vtt = await transcribeUploadedVideo({
      uploadId,
      chunkCount,
      extension: extension || "mp4",
    });

    return Response.json({ vtt });
  } catch (error) {
    console.error("Transcribe complete failed:", error);
    const message =
      error instanceof Error ? error.message : "The video could not be transcribed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
