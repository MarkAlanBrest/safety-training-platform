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
import {
  classroomChapterDeckAssetPath,
  classroomChapterSlideAssetPath,
} from "@/lib/classroom-chapters";
import {
  attachSlideIndicesToLineup,
  buildClassroomPlanFromLineup,
  createLineupId,
  type LessonLineupItem,
  type LineupContentSlide,
} from "@/lib/classroom-lineup";
import { MAX_FILE_BYTES, parsePptxBuffer, teachingContentFromParsedSlide } from "@/lib/ppt-ingest-core";
import type { ClassroomAssessmentQuestion } from "@/lib/classroom-lesson";
import {
  normalizeAssessmentQuestions,
  type ClassroomFinalTest,
  type QuestionType,
} from "@/lib/classroom-question-types";
import { slugify } from "@/lib/mason";
import { renderPptxSlides } from "@/lib/pptx-render-server";

function parseLineup(raw: unknown): LessonLineupItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is LessonLineupItem => {
    if (!item || typeof item !== "object") return false;
    const kind = (item as { kind?: string }).kind;
    return (
      kind === "content" ||
      kind === "formative" ||
      kind === "activity" ||
      kind === "video"
    );
  });
}

function parseAssessment(raw: unknown): ClassroomAssessmentQuestion[] {
  return normalizeAssessmentQuestions(raw);
}

function parseFinalTest(raw: unknown): ClassroomFinalTest | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const configRaw = (value.config || {}) as Record<string, unknown>;
  const questionBank = normalizeAssessmentQuestions(value.questionBank);
  if (!questionBank.length) return undefined;

  return {
    questionBank,
    config: {
      enabled: configRaw.enabled === true,
      questionCount: Math.max(1, Number(configRaw.questionCount) || questionBank.length),
      includedTypes: Array.isArray(configRaw.includedTypes)
        ? (configRaw.includedTypes.filter((item) => typeof item === "string") as QuestionType[])
        : [],
      randomizeQuestions: configRaw.randomizeQuestions !== false,
      randomizeChoiceOrder: configRaw.randomizeChoiceOrder !== false,
      passingScore: Math.min(100, Math.max(0, Number(configRaw.passingScore) || 80)),
      attemptsAllowed: Math.max(0, Number(configRaw.attemptsAllowed) || 0),
      timeLimitMinutes:
        typeof configRaw.timeLimitMinutes === "number" && configRaw.timeLimitMinutes > 0
          ? configRaw.timeLimitMinutes
          : null,
      certificateOnPass: configRaw.certificateOnPass !== false,
      aiReviewAfterSubmission: configRaw.aiReviewAfterSubmission !== false,
    },
  };
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
    const finalTest = parseFinalTest(JSON.parse(String(form.get("finalTest") || "null")));
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
      finalTest,
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

      assets.push(
        {
          courseId: created.id,
          path: classroomChapterDeckAssetPath(1),
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          content: Buffer.from(buffer),
        },
      );

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
