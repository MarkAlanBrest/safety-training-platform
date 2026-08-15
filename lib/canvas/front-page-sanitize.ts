export function sanitizeFrontPageBody(body: string) {
  let cleaned = body;

  for (let i = 0; i < 6; i += 1) {
    const next = cleaned
      .replace(/<div[^>]*data-student-alerts-embed[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<p>\s*<\/p>/gi, "");
    if (next === cleaned) break;
    cleaned = next;
  }

  return cleaned.trim();
}
