export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { resolveClassroomCourse } from "@/lib/classroom-course-lookup";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const courseSlug = (url.searchParams.get("courseSlug") || "").trim();
    const studentEmail = (url.searchParams.get("studentEmail") || "").trim().toLowerCase();

    if (!courseSlug || !studentEmail) {
      return Response.json({ error: "Missing course or student email." }, { status: 400 });
    }

    const resolved = await resolveClassroomCourse(courseSlug);
    if (!resolved) {
      return Response.json({ error: "Course not found." }, { status: 404 });
    }

    const attemptsAllowed = resolved.plan.finalTest?.config.attemptsAllowed ?? 0;

    if (resolved.courseId === null) {
      return Response.json({ attemptsUsed: 0, attemptsAllowed, attemptsRemaining: null });
    }

    const attemptsUsed = await prisma.classroomAttempt.count({
      where: { courseId: resolved.courseId, studentEmail },
    });

    const attemptsRemaining = attemptsAllowed > 0 ? Math.max(0, attemptsAllowed - attemptsUsed) : null;

    return Response.json({ attemptsUsed, attemptsAllowed, attemptsRemaining });
  } catch (error) {
    console.error("Attempt lookup failed:", error);
    const message = error instanceof Error ? error.message : "Could not check prior attempts.";
    return Response.json({ error: message }, { status: 500 });
  }
}
