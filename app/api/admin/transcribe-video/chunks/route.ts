export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { requireAdmin } from "@/lib/admin-session";
import { saveTranscribeChunk } from "@/lib/transcribe-staging";

const MAX_CHUNK_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const form = await request.formData();
    const uploadId = String(form.get("uploadId") || "").trim();
    const chunkIndex = Number(form.get("chunkIndex"));
    const chunkCount = Number(form.get("chunkCount"));
    const chunk = form.get("chunk");

    if (!uploadId || !Number.isInteger(chunkIndex) || !Number.isInteger(chunkCount)) {
      return Response.json({ error: "Upload metadata is incomplete." }, { status: 400 });
    }

    if (!(chunk instanceof File) || !chunk.size) {
      return Response.json({ error: "Upload a video chunk." }, { status: 400 });
    }

    if (chunk.size > MAX_CHUNK_BYTES) {
      return Response.json({ error: "Each upload chunk is too large." }, { status: 400 });
    }

    await saveTranscribeChunk({
      uploadId,
      chunkIndex,
      mimeType: chunk.type || "application/octet-stream",
      content: Buffer.from(await chunk.arrayBuffer()),
    });

    return Response.json({ ok: true, chunkIndex, chunkCount });
  } catch (error) {
    console.error("Transcribe chunk upload failed:", error);
    return Response.json({ error: "The video chunk could not be uploaded." }, { status: 500 });
  }
}
