import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeJwt, type JWTPayload } from "jose";

const GENERIC_CANVAS_ISSUERS = new Set([
  "https://canvas.instructure.com",
  "https://canvas.beta.instructure.com",
  "https://canvas.test.instructure.com",
]);

const LTI_LAUNCH_PRESENTATION_CLAIM =
  "https://purl.imsglobal.org/spec/lti/claim/launch_presentation";
const LTI_TOOL_PLATFORM_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/tool_platform";

function normalizeIssuer(issuer: string) {
  return issuer.trim().replace(/\/+$/, "");
}

export function isGenericCanvasIssuer(issuer: string) {
  return GENERIC_CANVAS_ISSUERS.has(normalizeIssuer(issuer));
}

function readInstitutionUrlFromConfigFile() {
  try {
    const configPath = join(process.cwd(), "public", "canvas-lti-key.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      institution_url?: string;
      canvas_url?: string;
    };
    const raw = config.institution_url || config.canvas_url;
    if (typeof raw !== "string" || !raw.trim()) return "";
    return raw.startsWith("http")
      ? normalizeIssuer(raw)
      : `https://${normalizeIssuer(raw)}`;
  } catch {
    return "";
  }
}

export function getCanvasBaseUrl() {
  const env = process.env.CANVAS_BASE_URL?.trim();
  if (env) {
    return env.startsWith("http") ? normalizeIssuer(env) : `https://${normalizeIssuer(env)}`;
  }
  return readInstitutionUrlFromConfigFile();
}

export function resolveCanvasIssuer(issuer: string) {
  const normalized = normalizeIssuer(issuer);
  if (isGenericCanvasIssuer(normalized)) {
    const baseUrl = getCanvasBaseUrl();
    if (baseUrl) return baseUrl;
  }
  return normalized;
}

export function extractSchoolIssuerFromJwt(idToken: string) {
  try {
    const payload = decodeJwt(idToken) as JWTPayload;
    const candidates: string[] = [];

    if (typeof payload.iss === "string") candidates.push(payload.iss);

    const launchPresentation = payload[LTI_LAUNCH_PRESENTATION_CLAIM];
    if (launchPresentation && typeof launchPresentation === "object") {
      const returnUrl = (launchPresentation as Record<string, unknown>).return_url;
      if (typeof returnUrl === "string") {
        candidates.push(new URL(returnUrl).origin);
      }
    }

    const toolPlatform = payload[LTI_TOOL_PLATFORM_CLAIM];
    if (toolPlatform && typeof toolPlatform === "object") {
      for (const value of Object.values(toolPlatform as Record<string, unknown>)) {
        if (typeof value === "string" && value.includes("instructure.com")) {
          candidates.push(value.startsWith("http") ? value : `https://${value}`);
        }
      }
    }

    for (const candidate of candidates) {
      const normalized = normalizeIssuer(candidate);
      if (normalized.includes("instructure.com") && !isGenericCanvasIssuer(normalized)) {
        return normalized;
      }
    }
  } catch {
    // Ignore malformed tokens here; verification happens later.
  }

  return null;
}

export function extractSchoolIssuerFromRequest(request: Request) {
  for (const header of ["referer", "origin"]) {
    const value = request.headers.get(header);
    if (!value) continue;
    try {
      const origin = new URL(value).origin;
      if (origin.includes("instructure.com") && !isGenericCanvasIssuer(origin)) {
        return origin;
      }
    } catch {
      // Ignore invalid header URLs.
    }
  }
  return null;
}

export function collectCanvasIssuerCandidates(
  issuer: string,
  options?: { idToken?: string; request?: Request },
) {
  const ordered: string[] = [];
  const add = (value?: string | null) => {
    if (!value) return;
    const normalized = normalizeIssuer(value);
    if (!normalized.includes("instructure.com")) return;
    if (isGenericCanvasIssuer(normalized)) return;
    if (!ordered.includes(normalized)) ordered.push(normalized);
  };

  add(getCanvasBaseUrl());
  if (options?.idToken) add(extractSchoolIssuerFromJwt(options.idToken));
  if (options?.request) add(extractSchoolIssuerFromRequest(options.request));

  const resolved = resolveCanvasIssuer(issuer);
  add(resolved);
  if (!isGenericCanvasIssuer(issuer)) add(issuer);

  return ordered;
}

export function issuerResolutionHint(issuer: string) {
  if (!isGenericCanvasIssuer(issuer)) return null;
  return (
    "Canvas sent a generic issuer. Set CANVAS_BASE_URL in Vercel to your school URL " +
    "(e.g. https://mytrades.instructure.com), or add institution_url to public/canvas-lti-key.json."
  );
}
