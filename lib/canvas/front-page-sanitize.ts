export function sanitizeFrontPageBody(body: string) {
  let cleaned = body;

  cleaned = cleaned.replace(/<div data-student-alerts-embed="true">[\s\S]*?<\/div>\s*/gi, "");
  cleaned = cleaned.replace(/<iframe\b[^>]*\/?>(?:\s*<\/iframe>)?\s*/gi, "");
  cleaned = cleaned.replace(/<p>\s*<\/p>\s*/gi, "");

  return cleaned.trim();
}
