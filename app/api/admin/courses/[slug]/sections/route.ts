export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateLessonPlan } from "@/lib/mason-generator";
import { requireAdmin } from "@/lib/admin-session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug } = await params;
    const course = await prisma.masonCourse.findUnique({
      where: { slug },
      include: { _count: { select: { sections: true } } },
    });
    if (!course) {
      return Response.json({ error: "Course not found." }, { status: 404 });
    }

    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json();
      const title = String(body.title || "New section").trim().slice(0, 160);
      const estimatedMinutes = Math.max(
        5,
        Math.min(10000, Number(body.estimatedMinutes) || 15),
      );
      if (!title) {
        return Response.json({ error: "A section title is required." }, { status: 400 });
      }

      const section = await prisma.masonSection.create({
        data: {
          courseId: course.id,
          title,
          estimatedMinutes,
          position: course._count.sections + 1,
          fileName: "Manual section",
          lessonPlan: {
            sectionTitle: title,
            opening: "Add an introduction for this section.",
            objectives: [],
            summary: "Add a closing summary.",
            keyFacts: [],
            moments: [],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        select: {
          id: true,
          title: true,
          position: true,
          estimatedMinutes: true,
          fileName: true,
          lessonPlan: true,
        },
      });
      return Response.json(section, { status: 201 });
    }

    const form = await request.formData();
    const title = String(form.get("sectionTitle") || "").trim();
    const estimatedMinutes = Math.max(
      5,
      Math.min(10000, Number(form.get("estimatedMinutes")) || 15),
    );
    const file = form.get("pdf");

    if (!title || !(file instanceof File) || file.type !== "application/pdf") {
      return Response.json(
        { error: "A section title and PDF are required." },
        { status: 400 },
      );
    }
    if (file.size > 25 * 1024 * 1024) {
      return Response.json({ error: "PDF files are limited to 25 MB." }, { status: 400 });
    }

    const pdf = Buffer.from(await file.arrayBuffer());
    const lessonPlan = await generateLessonPlan({
      pdf,
      fileName: file.name,
      courseTitle: course.title,
      sectionTitle: title,
      intensity: course.intensity,
      estimatedMinutes,
    });

    const section = await prisma.masonSection.create({
      data: {
        courseId: course.id,
        title,
        estimatedMinutes,
        position: course._count.sections + 1,
        fileName: file.name,
        lessonPlan: lessonPlan as unknown as Prisma.InputJsonValue,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        position: true,
        estimatedMinutes: true,
        fileName: true,
        lessonPlan: true,
      },
    });

    return Response.json(section, { status: 201 });
  } catch (error) {
    console.error("Course section creation failed:", error);
    const message =
      error instanceof Error ? error.message : "The section could not be created.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug } = await params;
    const body = await request.json();
    const sectionIds = Array.isArray(body.sectionIds)
      ? body.sectionIds.map(Number)
      : [];
    const course = await prisma.masonCourse.findUnique({
      where: { slug },
      include: { sections: { select: { id: true } } },
    });
    if (!course) {
      return Response.json({ error: "Course not found." }, { status: 404 });
    }

    const existingIds = course.sections.map((section) => section.id).sort((a, b) => a - b);
    const requestedIds = [...sectionIds].sort((a, b) => a - b);
    if (
      sectionIds.length !== course.sections.length ||
      existingIds.some((id, index) => id !== requestedIds[index])
    ) {
      return Response.json({ error: "Invalid section order." }, { status: 400 });
    }

    await prisma.$transaction(async (transaction) => {
      for (let index = 0; index < sectionIds.length; index += 1) {
        await transaction.masonSection.update({
          where: { id: sectionIds[index] },
          data: { position: -(index + 1) },
        });
      }
      for (let index = 0; index < sectionIds.length; index += 1) {
        await transaction.masonSection.update({
          where: { id: sectionIds[index] },
          data: { position: index + 1 },
        });
      }
      await transaction.masonCourse.update({
        where: { id: course.id },
        data: { updatedAt: new Date() },
      });
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Section reorder failed:", error);
    return Response.json({ error: "Sections could not be reordered." }, { status: 500 });
  }
}
