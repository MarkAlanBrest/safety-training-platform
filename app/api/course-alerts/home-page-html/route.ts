export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  buildCourseAnnouncementBody,
  COURSE_ALERT_ANNOUNCEMENT_TITLE,
} from "@/lib/canvas/course-home-page-html";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim() || url.searchParams.get("course")?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const config = await getCourseAlertConfig(courseId);

  return NextResponse.json({
    courseId,
    title: COURSE_ALERT_ANNOUNCEMENT_TITLE,
    html: buildCourseAnnouncementBody(config.bannerMessage),
    instructions: [
      "Canvas → your course → Announcements → + Announcement",
      `Title: ${COURSE_ALERT_ANNOUNCEMENT_TITLE}`,
      "Switch to HTML view and paste the html value below",
      "Publish the announcement",
    ],
  });
}
