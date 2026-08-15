import { getAppOrigin } from "@/lib/canvas/config";

export async function setupCourseHomeStudentAlerts(
  _canvasCourseId: string,
  _options?: { bannerMessage?: string | null },
) {
  const appOrigin = getAppOrigin();
  return {
    ok: true as const,
    mode: "theme_popup" as const,
    themeSnippetUrl: appOrigin ? `${appOrigin}/canvas/theme-snippet.txt` : null,
    note:
      "Settings saved. Your popup message is ready. Paste the one-time Canvas theme script (link below) so students see a bold popup on the course home page.",
  };
}
