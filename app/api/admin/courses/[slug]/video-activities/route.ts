export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";
import {
  classroomVideoAssetUrl,
  hydrateVideoCourse,
  sortVideoMarkers,
  type VideoCourseConfig,
  type VideoTimelineMarker,
} from "@/lib/classroom-video";
import { isClassroomPlan } from "@/lib/classroom";

function parseMarkers(raw: unknown): VideoTimelineMarker[] {
  if (!Array.isArray(raw)) return [];
  return sortVideoMarkers(
    raw
      .filter((item): item is VideoTimelineMarker => {
        if (!item || typeof item !== "object") return false;
        const marker = item as VideoTimelineMarker;
        return (
          typeof marker.id === "string" &&
          typeof marker.atSeconds === "number" &&
          typeof marker.kind === "string"
        );
      })
      .map((marker) => ({
        ...marker,
        atSeconds: Math.max(0, marker.atSeconds),
        label: marker.label?.trim() || undefined,
        aiScript: marker.aiScript?.trim() || undefined,
        questionPrompt: marker.questionPrompt?.trim() || undefined,
        correctAnswer: marker.correctAnswer?.trim() || undefined,
        options: marker.options?.map((option) => option.trim()).filter(Boolean),
      })),
  );
}

function readVideoCourse(section: { lessonPlan: unknown } | undefined, slug: string) {
  if (!section?.lessonPlan || !isClassroomPlan(section.lessonPlan) || !section.lessonPlan.videoCourse) {
    return null;
  }
  return hydrateVideoCourse(section.lessonPlan.videoCourse, slug);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { position: "asc" },
        take: 1,
        select: { id: true, lessonPlan: true },
      },
    },
  });

  if (!course || course.courseType !== "classroom") {
    return Response.json({ error: "Course not found." }, { status: 404 });
  }

  const videoCourse = readVideoCourse(course.sections[0], slug);
  if (!videoCourse) {
    return Response.json({ error: "This course is not a video course." }, { status: 400 });
  }

  return Response.json({
    title: course.title,
    slug: course.slug,
    published: course.published,
    sectionId: course.sections[0]?.id,
    videoCourse: {
      ...videoCourse,
      videoUrl: videoCourse.videoUrl || classroomVideoAssetUrl(slug, videoCourse.videoAssetPath),
      captionsUrl: videoCourse.captionsUrl,
      markers: videoCourse.markers || [],
      publishedMarkers: videoCourse.publishedMarkers || [],
      activitiesPublished: Boolean(videoCourse.activitiesPublished),
      durationSeconds: videoCourse.durationSeconds,
    },
  });
}

type PatchBody = {
  action?: "save-draft" | "publish" | "unpublish";
  markers?: VideoTimelineMarker[];
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const body = (await request.json()) as PatchBody;
  const action = body.action || "save-draft";

  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { position: "asc" },
        take: 1,
        select: { id: true, lessonPlan: true },
      },
    },
  });

  if (!course || course.courseType !== "classroom") {
    return Response.json({ error: "Course not found." }, { status: 404 });
  }

  const section = course.sections[0];
  if (!section?.lessonPlan || !isClassroomPlan(section.lessonPlan) || !section.lessonPlan.videoCourse) {
    return Response.json({ error: "This course is not a video course." }, { status: 400 });
  }

  const current = section.lessonPlan.videoCourse as VideoCourseConfig;
  const draftMarkers =
    body.markers !== undefined ? parseMarkers(body.markers) : sortVideoMarkers(current.markers || []);

  let nextVideoCourse: VideoCourseConfig = {
    ...current,
    markers: draftMarkers,
    publishedMarkers: current.publishedMarkers,
    activitiesPublished: Boolean(current.activitiesPublished),
  };

  if (action === "publish") {
    nextVideoCourse = {
      ...nextVideoCourse,
      publishedMarkers: draftMarkers,
      activitiesPublished: true,
    };
  } else if (action === "unpublish") {
    nextVideoCourse = {
      ...nextVideoCourse,
      activitiesPublished: false,
    };
  } else {
    nextVideoCourse = {
      ...nextVideoCourse,
      markers: draftMarkers,
    };
  }

  await prisma.masonSection.update({
    where: { id: section.id },
    data: {
      lessonPlan: {
        ...section.lessonPlan,
        videoCourse: nextVideoCourse,
      } as Prisma.InputJsonValue,
    },
  });

  const hydrated = hydrateVideoCourse(nextVideoCourse, slug);

  return Response.json({
    videoCourse: {
      markers: hydrated.markers,
      publishedMarkers: hydrated.publishedMarkers || [],
      activitiesPublished: Boolean(hydrated.activitiesPublished),
    },
  });
}
