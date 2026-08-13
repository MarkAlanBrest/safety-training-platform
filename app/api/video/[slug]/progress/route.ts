export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { normalizeEnrollmentCode } from "@/lib/enrollment-code";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  normalizeVideoPlan,
  videoCourseCompleted,
  videoProgressFromEnrollment,
  videoProgressPercent,
  type VideoProgressData,
} from "@/lib/video";

async function enrollmentFor(slug: string, code: string) {
  const access = await prisma.enrollmentCode.findUnique({
    where: { code: normalizeEnrollmentCode(code) },
    include: { course: true, enrollment: true },
  });
  if (!access || access.course.slug !== slug || access.course.courseType !== "video" || !access.enrollment) {
    return null;
  }
  return access;
}

function progressPayload(
  progress: VideoProgressData,
  percent: number,
  completed: boolean,
  code: string,
) {
  return {
    progress: progress,
    percent,
    status: completed ? "completed" : "active",
    certificateUrl: completed ? `/certificate?code=${encodeURIComponent(code)}` : null,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const code = new URL(request.url).searchParams.get("code") || "";
  const access = await enrollmentFor(slug, code);
  if (!access) {
    return Response.json({ error: "A valid claimed enrollment code is required." }, { status: 403 });
  }

  const section = await prisma.masonSection.findFirst({
    where: { courseId: access.course.id },
    orderBy: { position: "asc" },
    select: { lessonPlan: true },
  });
  const plan = normalizeVideoPlan(section?.lessonPlan, access.course.title);
  if (!plan) {
    return Response.json({ error: "The video course plan is invalid." }, { status: 500 });
  }

  const progress = videoProgressFromEnrollment(access.enrollment!.scormData);
  const percent = videoProgressPercent(plan, progress);
  const completed = access.enrollment!.status === "completed";

  return Response.json({
    ...progressPayload(progress, percent, completed, normalizeEnrollmentCode(code)),
    score: access.enrollment!.score,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const code = normalizeEnrollmentCode(body.code);
    const access = await enrollmentFor(slug, code);
    if (!access) {
      return Response.json({ error: "A valid claimed enrollment code is required." }, { status: 403 });
    }

    const section = await prisma.masonSection.findFirst({
      where: { courseId: access.course.id },
      orderBy: { position: "asc" },
      select: { lessonPlan: true },
    });
    const plan = normalizeVideoPlan(section?.lessonPlan, access.course.title);
    if (!plan) {
      return Response.json({ error: "The video course plan is invalid." }, { status: 500 });
    }

    const current = videoProgressFromEnrollment(access.enrollment!.scormData);
    const next: VideoProgressData = {
      currentSeconds: Math.max(
        current.currentSeconds,
        Number(body.currentSeconds) || 0,
      ),
      maxWatchedSeconds: Math.max(
        current.maxWatchedSeconds,
        Number(body.maxWatchedSeconds) || 0,
        Number(body.currentSeconds) || 0,
      ),
      completedCueIds: Array.from(
        new Set([
          ...current.completedCueIds,
          ...(Array.isArray(body.completedCueIds)
            ? body.completedCueIds.filter((item: unknown): item is string => typeof item === "string")
            : []),
        ]),
      ),
    };

    const percent = videoProgressPercent(plan, next);
    const completed = videoCourseCompleted(plan, next);

    await prisma.courseEnrollment.update({
      where: { id: access.enrollment!.id },
      data: {
        scormData: { video: next } as Prisma.InputJsonValue,
        progress: completed ? 100 : Math.max(access.enrollment!.progress, percent),
        status: completed ? "completed" : "active",
        score: completed ? Math.max(access.enrollment!.score || 0, percent) : access.enrollment!.score,
        completedAt: completed ? access.enrollment!.completedAt || new Date() : null,
        lastAccessedAt: new Date(),
      },
    });

    return Response.json({
      success: true,
      completed,
      ...progressPayload(next, percent, completed, code),
    });
  } catch (error) {
    console.error("Video progress save failed:", error);
    return Response.json({ error: "Video progress could not be saved." }, { status: 500 });
  }
}
