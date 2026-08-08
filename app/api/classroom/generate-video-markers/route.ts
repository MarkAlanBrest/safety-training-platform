export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { requireAdmin } from "@/lib/admin-session";
import { generateVideoMarkers } from "@/lib/video-marker-generator";

type GenerateVideoMarkersBody = {
  courseTitle?: string;
  courseDescription?: string;
  vtt?: string;
  durationSeconds?: number;
  intervalSeconds?: number;
};

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const body = (await request.json()) as GenerateVideoMarkersBody;
    const courseTitle = String(body.courseTitle || "").trim();
    const courseDescription = String(body.courseDescription || "").trim();
    const vtt = String(body.vtt || "").trim();
    const durationSeconds = Number(body.durationSeconds);
    const intervalSeconds = Math.max(
      30,
      Math.min(180, Number(body.intervalSeconds) || 60),
    );

    if (!courseTitle) {
      return Response.json({ error: "A course title is required." }, { status: 400 });
    }
    if (!vtt) {
      return Response.json({ error: "A transcript is required to generate stop points." }, { status: 400 });
    }

    const result = await generateVideoMarkers({
      courseTitle,
      courseDescription: courseDescription || undefined,
      vtt,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined,
      intervalSeconds,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Video marker generation failed:", error);
    const message = error instanceof Error ? error.message : "Stop points could not be generated.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
