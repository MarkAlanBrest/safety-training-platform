export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin-session";
import {
  createScormCourseShell,
  importScormZipIntoCourse,
} from "@/lib/scorm-course-create";
import { MAX_SCORM_ZIP_BYTES, maxScormZipMb } from "@/lib/scorm-limits";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const file = form.get("scorm");

    if (!title || !(file instanceof File)) {
      return Response.json({ error: "A course title and SCORM ZIP package are required." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return Response.json({ error: "SCORM packages must be uploaded as ZIP files." }, { status: 400 });
    }
    if (file.size > MAX_SCORM_ZIP_BYTES) {
      return Response.json(
        { error: `SCORM ZIP uploads are limited to ${maxScormZipMb()} MB.` },
        { status: 400 },
      );
    }

    const course = await createScormCourseShell({
      title,
      description: String(form.get("description") || ""),
      audience: String(form.get("audience") || ""),
      theme: String(form.get("theme") || "heritage"),
      estimatedMinutes: Number(form.get("estimatedMinutes")) || 60,
      voiceProvider: String(form.get("voiceProvider") || "premium"),
      narrationMode: ["package", "premium", "browser"].includes(String(form.get("narrationMode")))
        ? (String(form.get("narrationMode")) as "package" | "premium" | "browser")
        : undefined,
      voice: String(form.get("voice") || "cedar"),
      fileName: file.name,
    });

    const parsed = await importScormZipIntoCourse(
      course.id,
      new Uint8Array(await file.arrayBuffer()),
    );

    return Response.json({ course, assetCount: parsed.assets.length }, { status: 201 });
  } catch (error) {
    console.error("SCORM course creation failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "The SCORM package could not be imported." },
      { status: 400 },
    );
  }
}
