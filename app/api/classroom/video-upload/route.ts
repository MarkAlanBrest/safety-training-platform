export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";
import {
  defaultClassroomBuilderConfig,
  type ClassroomBuilderConfig,
} from "@/lib/classroom-builder";
import {
  buildVideoClassroomPlan,
  sortVideoChapters,
  type VideoChapter,
} from "@/lib/classroom-video";
import { slugify } from "@/lib/mason";

type VideoUploadBody = {
  title?: string;
  description?: string;
  published?: boolean;
  config?: ClassroomBuilderConfig;
  videoAssetPath?: string;
  captionsAssetPath?: string;
  durationSeconds?: number;
  chapters?: VideoChapter[];
};

function parseChapters(raw: unknown): VideoChapter[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is VideoChapter => {
      if (!item || typeof item !== "object") return false;
      const chapter = item as VideoChapter;
      return (
        typeof chapter.id === "string" &&
        typeof chapter.title === "string" &&
        typeof chapter.startSeconds === "number"
      );
    })
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.title.trim(),
      startSeconds: Math.max(0, chapter.startSeconds),
    }));
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const body = (await request.json()) as VideoUploadBody;
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const published = body.published === true;
    const videoAssetPath = String(body.videoAssetPath || "").trim();
    const captionsAssetPath = String(body.captionsAssetPath || "").trim() || undefined;
    const chapters = sortVideoChapters(parseChapters(body.chapters));
    const config = defaultClassroomBuilderConfig(body.config);

    if (!title) {
      return Response.json({ error: "A course title is required." }, { status: 400 });
    }
    if (!videoAssetPath.startsWith("classroom/media/")) {
      return Response.json({ error: "Upload the course video before publishing." }, { status: 400 });
    }

    let slug = slugify(title);
    const existing = await prisma.masonCourse.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const durationMinutes = Math.max(
      5,
      Math.ceil((body.durationSeconds || 600) / 60),
    );

    const plan = buildVideoClassroomPlan({
      title,
      description,
      config,
      videoCourse: {
        videoAssetPath,
        captionsAssetPath,
        durationSeconds: body.durationSeconds,
        chapters,
        markers: [],
        publishedMarkers: [],
        activitiesPublished: false,
      },
    });

    const course = await prisma.masonCourse.create({
      data: {
        title,
        slug,
        description: description || `Video course with AI instructor — ${title}`,
        courseType: "classroom",
        displayMode: "classroom",
        published: false,
        estimatedMinutes: durationMinutes,
        intensity: "standard",
        sections: {
          create: [
            {
              title,
              position: 1,
              estimatedMinutes: durationMinutes,
              fileName: "video-course",
              lessonPlan: plan,
            },
          ],
        },
      },
      select: { id: true, title: true, slug: true, published: true },
    });

    return Response.json({
      course,
      published: published && course.published,
      previewUrl: `/classroom/${course.slug}`,
      adminUrl: `/admin/courses/${course.slug}`,
      stagedAssets: true,
    });
  } catch (error) {
    console.error("Video course upload failed:", error);
    const message =
      error instanceof Error ? error.message : "The course could not be created.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
