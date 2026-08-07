export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase();

    if (!code) {
      return Response.json({ error: "No course code provided." }, { status: 400 });
    }

    const enrollmentCode = await prisma.enrollmentCode.findUnique({
      where: { code },
      include: { course: true, enrollment: true },
    });

    if (!enrollmentCode) {
      return Response.json({ error: "Invalid course code." }, { status: 404 });
    }

    const enrollment = enrollmentCode.enrollment;
    if (!enrollment || enrollment.status !== "completed" || !enrollment.completedAt) {
      return Response.json(
        { error: "Complete the course and pass the final exam to view this certificate." },
        { status: 403 },
      );
    }

    return Response.json({
      id: enrollment.id,
      FirstName: enrollment.firstName,
      LastName: enrollment.lastName,
      CourseName: enrollmentCode.course.title,
      CertificateId: `NCST-${enrollmentCode.course.id}-${enrollment.id}`,
      CompletedAt: enrollment.completedAt,
    });
  } catch (error) {
    console.error("Course lookup failed:", error);
    return Response.json(
      { error: "The training database is unavailable." },
      { status: 500 },
    );
  }
}
