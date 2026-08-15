export const COURSE_ALERT_ANNOUNCEMENT_TITLE = "Student Alerts Reminder";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCourseAnnouncementBody(bannerMessage?: string | null) {
  const message =
    bannerMessage?.trim() ||
    "Check your missing work and grades in the alert panel at the top of this Home page.";

  return [
    '<div style="padding:16px 18px;border-radius:12px;background:#b91c1c;color:#fff;">',
    `<p style="margin:0 0 8px;font-size:1.15em;font-weight:800;">Reminder</p>`,
    `<p style="margin:0;font-size:1.05em;font-weight:700;">${escapeHtml(message)}</p>`,
    "</div>",
  ].join("");
}
