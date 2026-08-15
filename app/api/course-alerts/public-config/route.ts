export const runtime = "nodejs";

import { getCourseAlertConfig } from "@/lib/course-alerts/store";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=60",
};

export async function GET(request: Request) {
  const courseId = new URL(request.url).searchParams.get("courseId")?.trim();
  if (!courseId) {
    return Response.json({ error: "Course id is required." }, { status: 400, headers: corsHeaders });
  }

  const config = await getCourseAlertConfig(courseId);
  return Response.json(
    {
      courseId: config.canvasCourseId,
      courseName: config.courseName,
      bannerMessage: config.bannerMessage,
      lowGradeThreshold: config.lowGradeThreshold,
      missingWorkDays: config.missingWorkDays,
      showMissing: config.showMissing,
      showLowGrades: config.showLowGrades,
    },
    { headers: corsHeaders },
  );
}
