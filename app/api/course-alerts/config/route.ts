export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminSession, requireAdmin } from "@/lib/admin-session";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { embedStudentAlertsOnCourseHome } from "@/lib/canvas/course-home-embed-result";
import { getCourseAlertConfig, saveCourseAlertConfig } from "@/lib/course-alerts/store";
import type { CourseAlertConfigInput } from "@/lib/course-alerts/config";

type ConfigBody = Partial<CourseAlertConfigInput> & {
  courseId?: string;
};

function configFromBody(body: ConfigBody, courseNameFallback?: string | null) {
  return {
    courseName: body.courseName || courseNameFallback,
    missingWorkDays: body.missingWorkDays,
    lowGradeThreshold: body.lowGradeThreshold,
    assignmentLowGradePercent: body.assignmentLowGradePercent,
    loginInactivityDays: body.loginInactivityDays,
    dueSoonHours: body.dueSoonHours,
    bannerMessage: body.bannerMessage,
    missingMessage: body.missingMessage,
    assignmentLowGradeMessage: body.assignmentLowGradeMessage,
    loginInactivityMessage: body.loginInactivityMessage,
    overallLowGradeMessage: body.overallLowGradeMessage,
    dueSoonMessage: body.dueSoonMessage,
    showMissing: body.showMissing,
    showLowGrades: body.showLowGrades,
    showAssignmentLowGrades: body.showAssignmentLowGrades,
    showLoginInactivity: body.showLoginInactivity,
    showDueSoon: body.showDueSoon,
    showMissingEmail: body.showMissingEmail,
    missingEmailSubject: body.missingEmailSubject,
    missingEmailBody: body.missingEmailBody,
    showAssignmentLowGradesEmail: body.showAssignmentLowGradesEmail,
    assignmentLowGradeEmailSubject: body.assignmentLowGradeEmailSubject,
    assignmentLowGradeEmailBody: body.assignmentLowGradeEmailBody,
    showLowGradesEmail: body.showLowGradesEmail,
    lowGradesEmailSubject: body.lowGradesEmailSubject,
    lowGradesEmailBody: body.lowGradesEmailBody,
    showLoginInactivityEmail: body.showLoginInactivityEmail,
    loginInactivityEmailSubject: body.loginInactivityEmailSubject,
    loginInactivityEmailBody: body.loginInactivityEmailBody,
    showDueSoonEmail: body.showDueSoonEmail,
    dueSoonEmailSubject: body.dueSoonEmailSubject,
    dueSoonEmailBody: body.dueSoonEmailBody,
    emailFrequencyDays: body.emailFrequencyDays,
    homeEmbedEnabled: true,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim() || url.searchParams.get("course")?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const config = await getCourseAlertConfig(courseId);
  return NextResponse.json({ config });
}

export async function PUT(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const admin = await getAdminSession(request);
  const body = (await request.json()) as ConfigBody;
  const courseId = body.courseId?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const config = await saveCourseAlertConfig(
    courseId,
    configFromBody(body),
    admin?.admin?.email || admin?.admin?.name || "teacher",
  );
  const homeEmbed = await embedStudentAlertsOnCourseHome(courseId);
  return NextResponse.json({ config, homeEmbed });
}

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this setup page from Canvas." }, { status: 401 });
  }
  if (session.role !== "instructor") {
    return NextResponse.json({ error: "Only a course instructor can change alert settings." }, { status: 403 });
  }

  const body = (await request.json()) as ConfigBody;
  const courseId = body.courseId?.trim() || session.courseId?.trim() || "";
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }
  if (session.courseId && courseId !== session.courseId) {
    return NextResponse.json({ error: "The course did not match this Canvas launch." }, { status: 403 });
  }

  const config = await saveCourseAlertConfig(
    courseId,
    configFromBody(body, session.courseName),
    session.name,
  );
  const homeEmbed = await embedStudentAlertsOnCourseHome(courseId);
  return NextResponse.json({ config, homeEmbed });
}
