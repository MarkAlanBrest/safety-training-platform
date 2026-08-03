export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import type { LessonPlan } from "@/lib/mason";

const momentKinds = new Set([
  "explain",
  "text",
  "tiles",
  "dragdrop",
  "visual",
  "flashcard",
  "hotspot",
  "tutor",
  "question",
  "scenario",
  "summary",
]);

function validStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every((item) => typeof item === "string")
  );
}

function validFlashcards(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 24 &&
      value.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).front === "string" &&
          typeof (item as Record<string, unknown>).back === "string",
      ))
  );
}

function validHotspotPoints(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 20 &&
      value.every((item) => {
        if (!item || typeof item !== "object") return false;
        const point = item as Record<string, unknown>;
        return (
          typeof point.x === "number" &&
          typeof point.y === "number" &&
          typeof point.label === "string" &&
          typeof point.text === "string"
        );
      }))
  );
}

function validTiles(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 12 &&
      value.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).title === "string" &&
          typeof (item as Record<string, unknown>).body === "string",
      ))
  );
}

function validLessonPlan(value: unknown): value is LessonPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  if (
    typeof plan.sectionTitle !== "string" ||
    typeof plan.opening !== "string" ||
    typeof plan.summary !== "string" ||
    !validStringArray(plan.objectives) ||
    !validStringArray(plan.keyFacts) ||
    !Array.isArray(plan.moments) ||
    plan.moments.length > 200
  ) {
    return false;
  }

  return plan.moments.every((value) => {
    if (!value || typeof value !== "object") return false;
    const moment = value as Record<string, unknown>;
    return (
      typeof moment.kind === "string" &&
      momentKinds.has(moment.kind) &&
      typeof moment.title === "string" &&
      typeof moment.narration === "string" &&
      (moment.choices === null ||
        moment.choices === undefined ||
        validStringArray(moment.choices)) &&
      (moment.dragItems === null ||
        moment.dragItems === undefined ||
        validStringArray(moment.dragItems)) &&
      validTiles(moment.tiles) &&
      validFlashcards(moment.flashcards) &&
      validHotspotPoints(moment.hotspotPoints)
    );
  });
}

async function findSection(slug: string, sectionId: number) {
  return prisma.masonSection.findFirst({
    where: { id: sectionId, course: { slug } },
    include: {
      course: {
        select: {
          title: true,
          slug: true,
          updatedAt: true,
        },
      },
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug, id } = await params;
  const sectionId = Number(id);
  if (!Number.isInteger(sectionId)) {
    return Response.json({ error: "Invalid section." }, { status: 400 });
  }

  const section = await findSection(slug, sectionId);
  if (!section) {
    return Response.json({ error: "Section not found." }, { status: 404 });
  }

  return Response.json(section);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug, id } = await params;
    const sectionId = Number(id);
    if (!Number.isInteger(sectionId)) {
      return Response.json({ error: "Invalid section." }, { status: 400 });
    }

    const existing = await findSection(slug, sectionId);
    if (!existing) {
      return Response.json({ error: "Section not found." }, { status: 404 });
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const estimatedMinutes = Math.max(
      5,
      Math.min(10000, Number(body.estimatedMinutes) || existing.estimatedMinutes),
    );
    if (!title || !validLessonPlan(body.lessonPlan)) {
      return Response.json(
        { error: "The section title and valid lesson content are required." },
        { status: 400 },
      );
    }

    const savedAt = new Date();
    await prisma.masonSection.update({
      where: { id: existing.id },
      data: {
        title,
        estimatedMinutes,
        lessonPlan: body.lessonPlan as unknown as Prisma.InputJsonValue,
        updatedAt: savedAt,
      },
    });
    await prisma.masonCourse.update({
      where: { id: existing.courseId },
      data: { updatedAt: savedAt },
    });
    const updated = await findSection(slug, sectionId);

    return Response.json(updated);
  } catch (error) {
    console.error("Section content update failed:", error);
    return Response.json(
      { error: "The section content could not be saved." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug, id } = await params;
    const sectionId = Number(id);
    if (!Number.isInteger(sectionId)) {
      return Response.json({ error: "Invalid section." }, { status: 400 });
    }

    const existing = await findSection(slug, sectionId);
    if (!existing) {
      return Response.json({ error: "Section not found." }, { status: 404 });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.masonSection.delete({ where: { id: existing.id } });
      const remaining = await transaction.masonSection.findMany({
        where: { courseId: existing.courseId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      for (let index = 0; index < remaining.length; index += 1) {
        await transaction.masonSection.update({
          where: { id: remaining[index].id },
          data: { position: index + 1 },
        });
      }
      await transaction.masonCourse.update({
        where: { id: existing.courseId },
        data: { updatedAt: new Date() },
      });
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Section deletion failed:", error);
    return Response.json({ error: "The section could not be deleted." }, { status: 500 });
  }
}
