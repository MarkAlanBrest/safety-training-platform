export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { buildTestHomePageBody } from "@/lib/canvas/course-home-page-html";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim() || url.searchParams.get("course")?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const config = await getCourseAlertConfig(courseId);
  const html = buildTestHomePageBody(config.bannerMessage);

  return NextResponse.json({
    courseId,
    html,
    instructions: [
      "Canvas → your course → Pages",
      "Open or create the course Front Page",
      "Click Edit → HTML Editor",
      "Paste the html value below → Save",
      "Course Settings → set Home Page to Front Page (if needed)",
    ],
  });
}
