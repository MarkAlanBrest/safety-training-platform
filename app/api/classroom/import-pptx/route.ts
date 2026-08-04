export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";
import {
  ClassroomBuilderConfig,
  defaultClassroomBuilderConfig,
  estimateClassroomCourse,
} from "@/lib/classroom-builder";
import { classroomChapterDeckAssetPath, classroomChapterSlideAssetPath } from "@/lib/classroom-chapters";
import {
  attachSlideIndicesToLineup,
  buildClassroomPlanFromLineup,
  createLineupId,
  type LessonLineupItem,
  type LineupContentSlide,
} from "@/lib/classroom-lineup";
import { MAX_FILE_BYTES, parsePptxBuffer, teachingContentFromParsedSlide } from "@/lib/ppt-ingest-core";
import type { ClassroomAssessmentQuestion } from "@/lib/classroom-lesson";
import { slugify } from "@/lib/mason";
import { renderPptxSlides } from "@/lib/pptx-render-server";

function parseLineup(raw: unknown): LessonLineupItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is LessonLineupItem => {
    if (!item || typeof item !== "object") return false;
    const kind = (item as { kind?: string }).kind;
    return kind === "content" || kind === "formative" || kind === "activity";
  });
}

function parseAssessment(raw: unknown): ClassroomAssessmentQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is ClassroomAssessmentQuestion =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as ClassroomAssessmentQuestion).prompt === "string" &&
        Array.isArray((item as ClassroomAssessmentQuestion).choices),
    )
    .map((item, index) => ({
      id: item.id || `assessment-${index + 1}`,
      prompt: item.prompt.trim(),
      choices: item.choices.map((choice) => String(choice).trim()).filter(Boolean),
      correctChoice: String(item.correctChoice || "").trim(),
    }))
    .filter((item) => item.prompt && item.choices.length >= 2)
    .map((item) => ({
      ...item,
      correctChoice: item.choices.includes(item.correctChoice)
        ? item.correctChoice
        : item.choices[0],
    }));
}

function parseBuilderConfig(raw: string | null): ClassroomBuilderConfig {
  if (!raw) return defaultClassroomBuilderConfig();
  try {
    return defaultClassroomBuilderConfig(JSON.parse(raw) as ClassroomBuilderConfig);
  } catch {
    return defaultClassroomBuilderConfig();
  }
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const form = await request.formData();
    const file = form.get("pptx");
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const published = String(form.get("published") || "false") === "true";
    const lineup = parseLineup(JSON.parse(String(form.get("lineup") || "[]")));
    const assessment = parseAssessment(JSON.parse(String(form.get("assessment") || "[]")));
    const config = parseBuilderConfig(String(form.get("config") || ""));

    if (!(file instanceof File) || !/\.pptx$/i.test(file.name)) {
      return Response.json({ error: "A .pptx PowerPoint file is required." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: "PowerPoint files are limited to 25 MB." }, { status: 400 });
    }
    if (!title) {
      return Response.json({ error: "A course title is required." }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const parsed = parsePptxBuffer(buffer);
    const contentSlides = lineup.filter(
      (item): item is LineupContentSlide => item.kind === "content",
    );

    if (contentSlides.length && contentSlides.length !== parsed.length) {
      return Response.json(
        {
          error: `The lesson has ${contentSlides.length} content slides but the PowerPoint has ${parsed.length}. Counts must match.`,
        },
        { status: 400 },
      );
    }

    const images = await renderPptxSlides(buffer, { preset: "hd", format: "png" });

    let slug = slugify(title);
    const existing = await prisma.masonCourse.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const attachedLineup =
      lineup.length > 0
        ? attachSlideIndicesToLineup(lineup)
        : attachSlideIndicesToLineup(
            parsed.map((slide, index) => ({
              kind: "content" as const,
              id: createLineupId("content"),
              title: slide.title,
              teachingContent: teachingContentFromParsedSlide(slide),
              slideIndex: index,
            })),
          );

    const mergedConfig = defaultClassroomBuilderConfig({
      ...config,
      knowledge: {
        ...config.knowledge,
        courseName: title,
        description: description || config.knowledge.description,
      },
    });

    const plan = buildClassroomPlanFromLineup(attachedLineup, title, slug, mergedConfig, {
      description,
      assessment,
    });

    const slideCount = attachedLineup.filter((item) => item.kind === "content").length;
    const estimates = estimateClassroomCourse(slideCount, mergedConfig);

    const course = await prisma.$transaction(async (tx) => {
      const created = await tx.masonCourse.create({
        data: {
          title,
          slug,
          description:
            description ||
            mergedConfig.knowledge.description ||
            `AI classroom built from ${file.name}.`,
          courseType: "classroom",
          displayMode: "classroom",
          published,
          estimatedMinutes: estimates.courseLengthMinutes,
          intensity:
            mergedConfig.knowledge.difficulty === "beginner"
              ? "essentials"
              : mergedConfig.knowledge.difficulty === "advanced"
                ? "comprehensive"
                : "standard",
          sections: {
            create: [
              {
                title,
                position: 1,
                estimatedMinutes: estimates.courseLengthMinutes,
                fileName: file.name,
                lessonPlan: plan,
              },
            ],
          },
        },
        select: { id: true, title: true, slug: true, published: true },
      });

      const assets = images.map((image, index) => ({
        courseId: created.id,
        path: classroomChapterSlideAssetPath(1, index),
        mimeType: image.mimeType,
        content: Buffer.from(image.bytes),
      }));

      assets.push({
        courseId: created.id,
        path: classroomChapterDeckAssetPath(1),
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        content: Buffer.from(buffer),
      });

      await tx.scormAsset.createMany({ data: assets });
      return created;
    });

    return Response.json({
      course,
      slideCount,
      published: course.published,
      estimates,
      previewUrl: `/classroom/${course.slug}`,
      adminUrl: `/admin/courses/${course.slug}`,
    });
  } catch (error) {
    console.error("PPTX import failed:", error);
    const message =
      error instanceof Error ? error.message : "The PowerPoint could not be imported.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
