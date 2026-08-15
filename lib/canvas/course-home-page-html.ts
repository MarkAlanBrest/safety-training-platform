export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildTestHomePageBody(bannerMessage?: string | null) {
  const message =
    bannerMessage?.trim() ||
    "Student Alerts is connected. Missing work and grade reminders will show here soon.";

  return [
    `<p><strong style="font-size:1.4em;">Student Alerts — test message</strong></p>`,
    `<p><strong>${escapeHtml(message)}</strong></p>`,
    `<p>If you can read this on the course home page, the Canvas home-page connection is working.</p>`,
  ].join("\n");
}
