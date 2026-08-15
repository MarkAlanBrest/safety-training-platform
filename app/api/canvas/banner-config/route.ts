export const runtime = "nodejs";

function parseShowOn() {
  const raw = (process.env.CANVAS_BANNER_SHOW_ON || "course_home").trim().toLowerCase();
  if (raw === "all" || raw === "everywhere") return "all";
  if (raw === "course_home" || raw === "course") return "course_home";
  return "dashboard";
}

export async function GET() {
  const enabled = (process.env.CANVAS_BANNER_ENABLED || "true").trim().toLowerCase() !== "false";
  const lowGradeThreshold = Number(process.env.CANVAS_LOW_GRADE_THRESHOLD || process.env.CANVAS_BANNER_LOW_GRADE_THRESHOLD || 70);

  return Response.json(
    {
      enabled,
      showOn: parseShowOn(),
      lowGradeThreshold: Number.isFinite(lowGradeThreshold) ? lowGradeThreshold : 70,
      missingWorkDays: Number(process.env.CANVAS_MISSING_WORK_DAYS || 14),
      showMissing: (process.env.CANVAS_BANNER_SHOW_MISSING || "true").trim().toLowerCase() !== "false",
      showLowGrades: (process.env.CANVAS_BANNER_SHOW_LOW_GRADES || "true").trim().toLowerCase() !== "false",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
