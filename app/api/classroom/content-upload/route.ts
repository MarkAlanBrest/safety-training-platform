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
import { slugify } from "@/lib/mason";

type ContentUploadBody = {
  title?: string;
  description?: string;
  published?: boolean;
  config?: ClassroomBuilderConfig;
  lineup?: LessonLineupItem[];
};

function parseLineup(raw: unknown): LessonLineupItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is LessonLineupItem => {
    if (!item || typeof item !== "object") return false;
    const kind = (item as { kind?: string }).kind;
    return kind === "content" || kind === "formative" || kind === "activity";
  });
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
    const config = defaultClassroomBuilderConfig(body.config);

    if (!title) {
      return Response.json({ error: "A course title is required." }, { status: 400 });
    }

    const contentSlides = lineup.filter(
      (item): item is LineupContentSlide => item.kind === "content",
    );
    if (!contentSlides.length) {
      return Response.json(
        { error: "Add at least one content slide with teaching notes." },
        { status: 400 },
      );
    }

    if (contentSlides.some((slide) => !slide.teachingContent.trim())) {
      return Response.json(
        { error: "Every content slide needs teaching notes for the AI instructor." },
        { status: 400 },
      );
    }

    let slug = slugify(title);
    const existing = await prisma.masonCourse.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const attachedLineup = attachSlideIndicesToLineup(lineup);
    const plan = buildClassroomPlanFromLineup(attachedLineup, title, slug, {
      ...config,
      knowledge: {
        ...config.knowledge,
        courseName: title,
        description: description || config.knowledge.description,
      },
    }, { description });

    const slideCount = contentSlideCount(attachedLineup);
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
          create: [
            {
              title,
              position: 1,
              estimatedMinutes: estimates.courseLengthMinutes,
              fileName: "content-slides",
              lessonPlan: plan,
            },
          ],
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
