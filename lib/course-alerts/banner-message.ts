const PLACEHOLDER_BANNER_MESSAGES = new Set([
  "check your missing work and grades below.",
  "test: student alerts are connected on your course home page.",
]);

export function isActionableBannerMessage(message: string | null | undefined) {
  const trimmed = message?.trim() || "";
  if (!trimmed) return false;
  return !PLACEHOLDER_BANNER_MESSAGES.has(trimmed.toLowerCase());
}
