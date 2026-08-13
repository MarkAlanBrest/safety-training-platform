export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin-session";
import { createVideoCourse } from "@/lib/video-course-create";
import { normalizeVideoCue } from "@/lib/video";

type CreateBody = {
  title?: string;
  description?: string;
  audience?: string;
  theme?: string;
  estimatedMinutes?: number;
  videoUrl?: string;
  cues?: unknown[];
};

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as CreateBody;
    const course = await createVideoCourse({
      title: String(body.title || ""),
      description: body.description,
      audience: body.audience,
      theme: body.theme,
      estimatedMinutes: body.estimatedMinutes,
      videoUrl: String(body.videoUrl || ""),
      cues: Array.isArray(body.cues)
        ? body.cues
            .map((item) => normalizeVideoCue(item))
            .filter((item): item is NonNullable<ReturnType<typeof normalizeVideoCue>> => Boolean(item))
        : [],
    });

    return Response.json({ course }, { status: 201 });
  } catch (error) {
    console.error("Video course creation failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "The video course could not be created." },
      { status: 400 },
    );
  }
}
