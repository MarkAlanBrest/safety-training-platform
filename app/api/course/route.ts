export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";

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

    if (enrollmentCode) {
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
    }

    const record = await prisma.courseRecords.findUnique({ where: { Code: code } });

    if (!record) {
      return Response.json({ error: "Invalid course code." }, { status: 404 });
    }

    let totalSlides: number | null = null;

    if (record.SlidesPath) {
      const modulePath = path.join(
        process.cwd(),
        "data",
        "courses",
        record.SlidesPath,
        "module.json",
      );

      try {
        const course = JSON.parse(await fs.readFile(modulePath, "utf8"));
        totalSlides = Number(course.totalSlides) || course.slides?.length || null;
      } catch {
        totalSlides = null;
      }
    }

    return Response.json({ ...record, TotalSlides: totalSlides });
  } catch (error) {
    console.error("Course lookup failed:", error);
    return Response.json(
      { error: "The training database is unavailable." },
      { status: 500 },
    );
  }
}
