const GENERIC_CANVAS_ISSUERS = new Set([
  "https://canvas.instructure.com",
  "https://canvas.beta.instructure.com",
  "https://canvas.test.instructure.com",
]);

function normalizeIssuer(issuer: string) {
  return issuer.trim().replace(/\/+$/, "");
}

export function getCanvasBaseUrl() {
  const raw = process.env.CANVAS_BASE_URL?.trim();
  if (!raw) return "";
  return raw.startsWith("http") ? normalizeIssuer(raw) : `https://${normalizeIssuer(raw)}`;
}

export function resolveCanvasIssuer(issuer: string) {
  const normalized = normalizeIssuer(issuer);
  if (GENERIC_CANVAS_ISSUERS.has(normalized)) {
    const baseUrl = getCanvasBaseUrl();
    if (baseUrl) return baseUrl;
  }
  return normalized;
}

export function issuerResolutionHint(issuer: string) {
  const normalized = normalizeIssuer(issuer);
  if (!GENERIC_CANVAS_ISSUERS.has(normalized)) return null;
  return `Canvas sent issuer ${normalized}. Set CANVAS_BASE_URL in Vercel to your school URL (e.g. https://mytrades.instructure.com).`;
}
