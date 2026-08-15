export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { installStudentAlertsToolSchoolWide } from "@/lib/canvas/course-home-embed";

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this setup page from Canvas." }, { status: 401 });
  }

  const result = await installStudentAlertsToolSchoolWide();
  return NextResponse.json(
    {
      ...result,
      note:
        result.ok && result.installed > 0
          ? `The Student Alerts tool is available in ${result.installed} course${result.installed === 1 ? "" : "s"}. Alert messages and thresholds stay per course — open setup in each class to configure that class.`
          : result.note || result.reason,
    },
    { status: result.ok ? 200 : 400 },
  );
}
