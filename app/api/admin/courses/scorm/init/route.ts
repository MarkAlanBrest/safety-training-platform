export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin-session";
import { createScormCourseShell } from "@/lib/scorm-course-create";

type InitBody = {
  title?: string;
  description?: string;
  audience?: string;
  theme?: string;
  estimatedMinutes?: number;
  voiceProvider?: string;
  voice?: string;
  fileName?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as InitBody;
    const fileName = String(body.fileName || "").trim();
    if (!fileName.toLowerCase().endsWith(".zip")) {
      return Response.json({ error: "SCORM packages must be uploaded as ZIP files." }, { status: 400 });
    }

    const course = await createScormCourseShell({
      title: String(body.title || ""),
      description: body.description,
      audience: body.audience,
      theme: body.theme,
      estimatedMinutes: body.estimatedMinutes,
      voiceProvider: body.voiceProvider,
      voice: body.voice,
      fileName,
    });

    return Response.json({
      course,
      uploadId: crypto.randomUUID(),
    }, { status: 201 });
  } catch (error) {
    console.error("SCORM course init failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "The SCORM course could not be created." },
      { status: 400 },
    );
  }
}
