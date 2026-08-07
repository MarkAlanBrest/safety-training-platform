export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";
import {
  ClassroomBuilderConfig,
  defaultClassroomBuilderConfig,
  estimateClassroomCourse,
} from "@/lib/classroom-builder";
import {
  attachSlideIndicesToLineup,
  buildClassroomPlanFromLineup,
  type LessonLineupItem,
  type LineupContentSlide,
} from "@/lib/classroom-lineup";
import type { ClassroomAssessmentQuestion } from "@/lib/classroom-lesson";
import {
  normalizeAssessmentQuestions,
  type ClassroomFinalTest,
  type QuestionType,
} from "@/lib/classroom-question-types";
import { slugify } from "@/lib/mason";

type ContentUploadBody = {
  title?: string;
  description?: string;
  published?: boolean;
  config?: ClassroomBuilderConfig;
  lineup?: LessonLineupItem[];
  chapters?: Array<{
    title?: string;
    fileName?: string;
    lineup?: LessonLineupItem[];
  }>;
  assessment?: ClassroomAssessmentQuestion[];
  finalTest?: ClassroomFinalTest;
};

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

function contentSlideCount(lineup: LessonLineupItem[]) {
  return lineup.filter((item) => item.kind === "content").length;
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const body = (await request.json()) as ContentUploadBody;
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const published = body.published === true;
    const lineup = parseLineup(body.lineup);
    const assessment = parseAssessment(body.assessment);
    const finalTest = parseFinalTest(body.finalTest);
    const config = defaultClassroomBuilderConfig(body.config);

    if (!title) {
      return Response.json({ error: "A course title is required." }, { status: 400 });
    }

    const requestedChapters = Array.isArray(body.chapters)
      ? body.chapters
          .map((chapter, index) => ({
            title: String(chapter?.title || `Chapter ${index + 1}`).trim(),
            fileName: String(chapter?.fileName || `chapter-${index + 1}.pptx`).trim(),
            lineup: parseLineup(chapter?.lineup),
          }))
          .filter((chapter) => chapter.lineup.length > 0)
      : [];
    const chapterInputs = requestedChapters.length
      ? requestedChapters
      : [{ title, fileName: "content-slides", lineup }];

    if (
      !chapterInputs.length ||
      chapterInputs.some(
        (chapter) =>
          !chapter.lineup.some((item): item is LineupContentSlide => item.kind === "content"),
      )
    ) {
      return Response.json(
        { error: "Every PowerPoint chapter must contain at least one slide." },
        { status: 400 },
      );
    }

    let slug = slugify(title);
    const existing = await prisma.masonCourse.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const mergedConfig = {
      ...config,
      knowledge: {
        ...config.knowledge,
        courseName: title,
        description: description || config.knowledge.description,
      },
    };
    const sectionPlans = chapterInputs.map((chapter, index) => {
      const attachedLineup = attachSlideIndicesToLineup(chapter.lineup);
      return {
        title: chapter.title || `Chapter ${index + 1}`,
        fileName: chapter.fileName,
        position: index + 1,
        lineup: attachedLineup,
        plan: buildClassroomPlanFromLineup(
          attachedLineup,
          chapter.title || title,
          slug,
          mergedConfig,
          {
            description: "",
            assessment: index === chapterInputs.length - 1 ? assessment : [],
            finalTest: index === chapterInputs.length - 1 ? finalTest : undefined,
          },
        ),
      };
    });

    const slideCount = sectionPlans.reduce(
      (total, section) => total + contentSlideCount(section.lineup),
      0,
    );
    const estimates = estimateClassroomCourse(slideCount, config);

    const course = await prisma.masonCourse.create({
      data: {
        title,
        slug,
        description:
          description ||
          config.knowledge.description ||
          `AI classroom built from ${slideCount} content slides.`,
        courseType: "classroom",
        displayMode: "classroom",
        published: false,
        estimatedMinutes: estimates.courseLengthMinutes,
        intensity:
          config.knowledge.difficulty === "beginner"
            ? "essentials"
            : config.knowledge.difficulty === "advanced"
              ? "comprehensive"
              : "standard",
        sections: {
          create: sectionPlans.map((section) => ({
              title: section.title,
              position: section.position,
              estimatedMinutes: estimates.courseLengthMinutes,
              fileName: section.fileName,
              lessonPlan: section.plan,
            })),
        },
      },
      select: { id: true, title: true, slug: true, published: true },
    });

    return Response.json({
      course,
      slideCount,
      published: published && course.published,
      estimates,
      previewUrl: `/classroom/${course.slug}`,
      adminUrl: `/admin/courses/${course.slug}`,
      stagedAssets: true,
    });
  } catch (error) {
    console.error("Content slide upload failed:", error);
    const message =
      error instanceof Error ? error.message : "The course could not be created.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
