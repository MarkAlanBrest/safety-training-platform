import { SignJWT, type JWTPayload } from "jose";
import {
  serializeCourseAlertCustomFields,
  type CourseAlertConfigInput,
} from "@/lib/course-alerts/config";
import { getToolKid, importToolPrivateKey } from "@/lib/lti/tool-jwk";

const DEEP_LINKING_CLAIM = "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings";
const MESSAGE_TYPE_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/message_type";
const VERSION_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/version";
const DEPLOYMENT_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/deployment_id";
const CONTENT_ITEMS_CLAIM = "https://purl.imsglobal.org/spec/lti-dl/claim/content_items";
const DATA_CLAIM = "https://purl.imsglobal.org/spec/lti-dl/claim/data";

export type DeepLinkingSettings = {
  deep_link_return_url: string;
  accept_types?: string[];
  data?: string;
};

export function readDeepLinkingSettings(payload: JWTPayload): DeepLinkingSettings | null {
  const settings = payload[DEEP_LINKING_CLAIM];
  if (!settings || typeof settings !== "object") return null;
  const record = settings as Record<string, unknown>;
  if (typeof record.deep_link_return_url !== "string") return null;
  return {
    deep_link_return_url: record.deep_link_return_url,
    accept_types: Array.isArray(record.accept_types)
      ? record.accept_types.filter((item): item is string => typeof item === "string")
      : undefined,
    data: typeof record.data === "string" ? record.data : undefined,
  };
}

export async function buildDeepLinkingResponse(params: {
  clientId: string;
  platformIssuer: string;
  deploymentId?: string | null;
  nonce: string;
  launchUrl: string;
  data?: string;
  config?: CourseAlertConfigInput;
}) {
  const key = await importToolPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const custom = params.config ? serializeCourseAlertCustomFields(params.config) : undefined;

  const payload: JWTPayload = {
    nonce: params.nonce,
    azp: params.clientId,
    [MESSAGE_TYPE_CLAIM]: "LtiDeepLinkingResponse",
    [VERSION_CLAIM]: "1.3.0",
    [CONTENT_ITEMS_CLAIM]: [
      {
        type: "ltiResourceLink",
        title: "Student Alerts",
        url: params.launchUrl,
        custom,
        iframe: {
          width: 900,
          height: 320,
        },
      },
    ],
  };

  if (params.deploymentId) {
    payload[DEPLOYMENT_CLAIM] = params.deploymentId;
  }

  if (params.data) {
    payload[DATA_CLAIM] = params.data;
  }

  const audience = canvasDeepLinkAudience(params.platformIssuer);

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: getToolKid(), typ: "JWT" })
    .setIssuer(params.clientId)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);
}

function canvasDeepLinkAudience(platformIssuer: string) {
  const issuer = platformIssuer.replace(/\/+$/, "");
  if (issuer.includes("instructure.com") && !issuer.includes("canvas.instructure.com")) {
    return "https://canvas.instructure.com";
  }
  return issuer || "https://canvas.instructure.com";
}

export function parseDeepLinkModuleId(
  settings: DeepLinkingSettings,
  payload?: JWTPayload,
): string | null {
  const candidates: string[] = [];

  try {
    const url = new URL(settings.deep_link_return_url);
    for (const key of ["module_id", "context_module_id", "moduleId"]) {
      const value = url.searchParams.get(key);
      if (value) candidates.push(value);
    }
    const pathMatch = url.pathname.match(/\/modules\/(\d+)/);
    if (pathMatch?.[1]) candidates.push(pathMatch[1]);
  } catch {
    // Ignore malformed return URLs.
  }

  if (settings.data) {
    try {
      const parsed = JSON.parse(settings.data) as Record<string, unknown>;
      for (const key of ["module_id", "context_module_id", "moduleId"]) {
        const value = parsed[key];
        if (typeof value === "string" || typeof value === "number") {
          candidates.push(String(value));
        }
      }
    } catch {
      const match = settings.data.match(/module_id["':=\s]+(\d+)/i);
      if (match?.[1]) candidates.push(match[1]);
    }
  }

  const custom = payload?.["https://purl.imsglobal.org/spec/lti/claim/custom"];
  if (custom && typeof custom === "object") {
    const record = custom as Record<string, unknown>;
    for (const key of ["module_id", "canvas_module_id", "context_module_id"]) {
      const value = record[key];
      if (typeof value === "string" || typeof value === "number") {
        candidates.push(String(value));
      }
    }
  }

  return candidates.find((id) => /^\d+$/.test(id)) || null;
}

