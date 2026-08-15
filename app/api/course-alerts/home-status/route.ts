export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim() || url.searchParams.get("course")?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  try {
    const client = createCanvasAdminClient();
    const config = await getCourseAlertConfig(courseId);
    const access = await client.getCourseAccess(courseId);

    if (!access.ok) {
      return NextResponse.json({
        courseId,
        courseAccess: false,
        error: access.reason,
        configSaved: Boolean(config.updatedAt && config.updatedAt !== new Date(0).toISOString()),
        bannerMessage: config.bannerMessage,
        ready: false,
      });
    }

    const homeStatus = await client.getCourseHomeStatus(courseId);

    return NextResponse.json({
      courseId,
      courseAccess: true,
      courseName: access.courseName,
      configSaved: Boolean(config.updatedAt && config.updatedAt !== new Date(0).toISOString()),
      bannerMessage: config.bannerMessage,
      home: homeStatus,
      ready: homeStatus.hasStudentAlertsAnnouncement,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not inspect course home.";
    return NextResponse.json({ error: message, ready: false }, { status: 500 });
  }
}
