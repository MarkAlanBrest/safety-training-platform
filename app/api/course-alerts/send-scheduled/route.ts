export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { listCoursesWithEmailAlertsEnabled, getCourseAlertConfig } from "@/lib/course-alerts/store";
import { sendCourseAlertsByCanvas } from "@/lib/course-alerts/send-by-canvas";

async function checkCronAuth(request: Request) {
  // Allow admin session OR a valid cron token
  const unauthorized = await requireAdmin(request);
  if (!unauthorized) return true;

  const token = process.env.COURSE_ALERTS_CRON_TOKEN?.trim();
  if (!token) return false;

  const url = new URL(request.url);
  const q = url.searchParams.get("token") || url.searchParams.get("cron_token");
  const header = request.headers.get("x-cron-token") || request.headers.get("authorization");
  const authToken = q || (header && header.replace(/^Bearer\s+/i, "")) || null;
  return authToken === token;
}

export async function POST(request: Request) {
  const ok = await checkCronAuth(request);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const courseIds = await listCoursesWithEmailAlertsEnabled();
  const results: Record<string, any> = {};
  let totalSent = 0;
  for (const courseId of courseIds) {
    try {
      const cfg = await getCourseAlertConfig(courseId);
      const freq = Number(cfg.emailFrequencyDays || 1);
      const last = cfg.lastEmailSentAt ? new Date(cfg.lastEmailSentAt) : null;
      const now = Date.now();
      if (last && now - last.getTime() < freq * 24 * 60 * 60 * 1000) {
        results[courseId] = { skipped: true, reason: `sent within ${freq} day(s)` };
        continue;
      }

      const res = await sendCourseAlertsByCanvas(courseId);
      results[courseId] = res;
      totalSent += (res?.sent || 0);
    } catch (err) {
      results[courseId] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ ok: true, totalSent, courseCount: courseIds.length, results });
}
