export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { normalizeEnrollmentCode } from "@/lib/enrollment-code";
import { prisma } from "@/lib/prisma";

const PASSING_SCORE = 80;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = normalizeEnrollmentCode(body.code);
    const courseSlug = String(body.courseSlug || "").trim();
    const answers = Array.isArray(body.answers) ? body.answers.map(Number) : [];

    if (!code || !courseSlug || !answers.length) {
      return Response.json({ error: "Course code, course, and exam answers are required." }, { status: 400 });
    }

    const enrollmentCode = await prisma.enrollmentCode.findUnique({
      where: { code },
      include: {
        course: { include: { sections: { orderBy: { position: "asc" } } } },
        enrollment: true,
      },
    });

    if (!enrollmentCode || enrollmentCode.course.slug !== courseSlug) {
      return Response.json({ error: "This enrollment code is not valid for this course." }, { status: 404 });
    }

    if (!enrollmentCode.enrollment) {
      return Response.json({ error: "This enrollment code has not been claimed." }, { status: 409 });
    }

    const finalSection = enrollmentCode.course.sections.at(-1);
    const lessonPlan = finalSection?.lessonPlan as {
      moments?: Array<{ phase?: string; choices?: string[] | null; correctAnswer?: number | null }>;
    } | undefined;
    const exam = (lessonPlan?.moments || []).filter(
      (moment) => moment.phase === "mastery" && moment.choices?.length && Number.isInteger(moment.correctAnswer),
    );

    if (!exam.length || answers.length !== exam.length) {
      return Response.json({ error: "The submitted exam does not match this course." }, { status: 400 });
    }

    const correct = exam.reduce(
      (total, question, index) => total + (answers[index] === question.correctAnswer ? 1 : 0),
      0,
    );
    const score = Math.round((correct / exam.length) * 100);
    if (score < PASSING_SCORE) {
      return Response.json(
        { error: `A score of ${PASSING_SCORE}% or higher is required to earn a certificate.`, score },
        { status: 400 },
      );
    }

    const completedAt = enrollmentCode.enrollment.completedAt || new Date();
    await prisma.courseEnrollment.update({
      where: { id: enrollmentCode.enrollment.id },
      data: {
        progress: 100,
        status: "completed",
        completedAt,
        lastAccessedAt: new Date(),
      },
    });

    return Response.json({
      success: true,
      score,
      certificateUrl: `/certificate?code=${encodeURIComponent(code)}`,
    });
  } catch (error) {
    console.error("Course completion failed:", error);
    return Response.json({ error: "Course completion could not be recorded." }, { status: 500 });
  }
}
