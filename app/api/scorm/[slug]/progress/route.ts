export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { normalizeEnrollmentCode } from "@/lib/enrollment-code";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

async function enrollmentFor(slug: string, code: string) {
  const access = await prisma.enrollmentCode.findUnique({
    where: { code: normalizeEnrollmentCode(code) },
    include: { course: true, enrollment: true },
  });
  if (!access || access.course.slug !== slug || access.course.courseType !== "scorm" || !access.enrollment) return null;
  return access;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const code = new URL(request.url).searchParams.get("code") || "";
  const access = await enrollmentFor(slug, code);
  if (!access) return Response.json({ error: "A valid claimed enrollment code is required." }, { status: 403 });
  return Response.json({
    data: access.enrollment!.scormData || {},
    progress: access.enrollment!.progress,
    status: access.enrollment!.status,
    score: access.enrollment!.score,
    certificateUrl: access.enrollment!.status === "completed"
      ? `/certificate?code=${encodeURIComponent(normalizeEnrollmentCode(code))}`
      : null,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const code = normalizeEnrollmentCode(body.code);
    const data = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data as Record<string, unknown> : null;
    if (!data || JSON.stringify(data).length > 250_000) {
      return Response.json({ error: "Invalid SCORM progress data." }, { status: 400 });
    }
    const access = await enrollmentFor(slug, code);
    if (!access) return Response.json({ error: "A valid claimed enrollment code is required." }, { status: 403 });

    const lessonStatus = String(data["cmi.core.lesson_status"] || "").toLowerCase();
    const completionStatus = String(data["cmi.completion_status"] || "").toLowerCase();
    const successStatus = String(data["cmi.success_status"] || "").toLowerCase();
    const failed = lessonStatus === "failed" || successStatus === "failed";
    const completed = !failed && (lessonStatus === "passed" || lessonStatus === "completed" || successStatus === "passed" || completionStatus === "completed");
    const rawScore = Number(data["cmi.core.score.raw"] ?? data["cmi.score.raw"]);
    const scaledScore = Number(data["cmi.score.scaled"]);
    const score = Number.isFinite(rawScore)
      ? Math.max(0, Math.min(100, Math.round(rawScore)))
      : Number.isFinite(scaledScore)
        ? Math.max(0, Math.min(100, Math.round(scaledScore * 100)))
        : access.enrollment!.score;

    await prisma.courseEnrollment.update({
      where: { id: access.enrollment!.id },
      data: {
        scormData: data as Prisma.InputJsonValue,
        score,
        progress: completed ? 100 : Math.max(access.enrollment!.progress, completionStatus === "incomplete" ? 1 : 0),
        status: completed ? "completed" : "active",
        completedAt: completed ? access.enrollment!.completedAt || new Date() : null,
        lastAccessedAt: new Date(),
      },
    });

    return Response.json({
      success: true,
      completed,
      certificateUrl: completed ? `/certificate?code=${encodeURIComponent(code)}` : null,
    });
  } catch (error) {
    console.error("SCORM progress save failed:", error);
    return Response.json({ error: "SCORM progress could not be saved." }, { status: 500 });
  }
}
