export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { requireAdmin } from "@/lib/admin-session";
import { transcribeDirectUpload } from "@/lib/transcribe-video-server";

const MAX_DIRECT_BYTES = 24 * 1024 * 1024;

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Upload an audio or video file to transcribe." }, { status: 400 });
    }

    if (file.size > MAX_DIRECT_BYTES) {
      return Response.json(
        {
          error:
            "This video is too large for a direct upload. The builder will upload it in parts automatically.",
        },
        { status: 400 },
      );
    }

    const vtt = await transcribeDirectUpload(file);
    return Response.json({ vtt });
  } catch (error) {
    console.error("Transcribe video route failed:", error);
    const message =
      error instanceof Error ? error.message : "The video could not be transcribed right now.";
    return Response.json({ error: message }, { status: 500 });
  }
}
