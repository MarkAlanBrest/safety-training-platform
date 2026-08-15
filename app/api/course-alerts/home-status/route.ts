export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim() || url.searchParams.get("course")?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const config = await getCourseAlertConfig(courseId);
  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim().replace(/\/+$/, "") || "";

  return NextResponse.json({
    courseId,
    configSaved: Boolean(config.updatedAt && config.updatedAt !== new Date(0).toISOString()),
    bannerMessage: config.bannerMessage,
    popupReady: Boolean(config.bannerMessage?.trim()),
    themeSnippetUrl: appOrigin ? `${appOrigin}/canvas/theme-snippet.txt` : null,
    ready: Boolean(config.bannerMessage?.trim()),
  });
}
