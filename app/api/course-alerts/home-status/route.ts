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
    const [homeStatus, tool, config] = await Promise.all([
      client.getCourseHomeStatus(courseId),
      client.findCourseExternalTool(courseId, {
        searchName: "Student Alerts",
      }),
      getCourseAlertConfig(courseId),
    ]);

    return NextResponse.json({
      courseId,
      configSaved: Boolean(config.updatedAt && config.updatedAt !== new Date(0).toISOString()),
      bannerMessage: config.bannerMessage,
      externalToolFound: Boolean(tool),
      externalToolId: tool?.id ?? null,
      home: homeStatus,
      ready:
        Boolean(tool) &&
        homeStatus.defaultView === "wiki" &&
        homeStatus.frontPageUrl === "student-alerts-home" &&
        homeStatus.hasStudentAlertsEmbed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not inspect course home.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
