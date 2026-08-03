export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import {
  isEnrollmentCodeExpired,
  normalizeEnrollmentCode,
} from "@/lib/enrollment-code";
import { learnerCoursePath } from "@/lib/course-routes";

export async function GET(request: Request) {
  const code = normalizeEnrollmentCode(new URL(request.url).searchParams.get("code"));
  if (!code) {
    return Response.json({ error: "Enter an enrollment code." }, { status: 400 });
  }

  const accessCode = await prisma.enrollmentCode.findUnique({
    where: { code },
    include: {
      course: {
        select: {
          title: true,
          slug: true,
          description: true,
          published: true,
          theme: true,
          estimatedMinutes: true,
          courseType: true,
        },
      },
      enrollment: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          progress: true,
          status: true,
        },
      },
    },
  });

  if (!accessCode) {
    return Response.json(
      { error: "This enrollment code was not recognized." },
      { status: 404 },
    );
  }
  if (!accessCode.course.published) {
    return Response.json(
      {
        error:
          "This training program is not published yet. Ask your administrator to publish it before learners can enroll.",
      },
      { status: 403 },
    );
  }
  if (isEnrollmentCodeExpired(accessCode.expiresAt)) {
    return Response.json({ error: "This enrollment code has expired." }, { status: 410 });
  }

  return Response.json({
    valid: true,
    claimed: Boolean(accessCode.enrollment),
    course: accessCode.course,
    enrollment: accessCode.enrollment,
    learnerPath: learnerCoursePath(
      accessCode.course.slug,
      accessCode.course.courseType,
    ),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = normalizeEnrollmentCode(body.code);
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (!code || !firstName || !lastName || !email) {
      return Response.json(
        { error: "Code, first name, last name, and email are required." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const accessCode = await tx.enrollmentCode.findUnique({
        where: { code },
        include: { course: true, enrollment: true },
      });

      if (!accessCode) {
        throw new Error("INVALID_CODE");
      }
      if (!accessCode.course.published) {
        throw new Error("UNPUBLISHED_COURSE");
      }
      if (isEnrollmentCodeExpired(accessCode.expiresAt)) {
        throw new Error("EXPIRED_CODE");
      }
      if (accessCode.enrollment || accessCode.status !== "available") {
        throw new Error("CLAIMED_CODE");
      }

      const enrollment = await tx.courseEnrollment.create({
        data: {
          courseId: accessCode.courseId,
          codeId: accessCode.id,
          firstName,
          lastName,
          email,
        },
      });

      await tx.enrollmentCode.update({
        where: { id: accessCode.id },
        data: { status: "claimed", claimedAt: new Date() },
      });

      return { enrollment, course: accessCode.course };
    });

    return Response.json(
      {
        success: true,
        course: {
          title: result.course.title,
          slug: result.course.slug,
          theme: result.course.theme,
          courseType: result.course.courseType,
        },
        learnerPath: learnerCoursePath(
          result.course.slug,
          result.course.courseType,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INVALID_CODE") {
      return Response.json(
        { error: "This enrollment code was not recognized." },
        { status: 404 },
      );
    }
    if (message === "UNPUBLISHED_COURSE") {
      return Response.json(
        {
          error:
            "This training program is not published yet. Ask your administrator to publish it before learners can enroll.",
        },
        { status: 403 },
      );
    }
    if (message === "EXPIRED_CODE") {
      return Response.json({ error: "This enrollment code has expired." }, { status: 410 });
    }
    if (message === "CLAIMED_CODE") {
      return Response.json(
        { error: "This enrollment code has already been claimed." },
        { status: 409 },
      );
    }
    console.error("Enrollment failed:", error);
    return Response.json({ error: "Enrollment could not be completed." }, { status: 500 });
  }
}
