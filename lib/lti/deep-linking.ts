import { importJWK, SignJWT, type JWTPayload } from "jose";
import {
  serializeCourseAlertCustomFields,
  type CourseAlertConfigInput,
} from "@/lib/course-alerts/config";

const DEEP_LINKING_CLAIM = "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings";
const MESSAGE_TYPE_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/message_type";
const VERSION_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/version";
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

async function getSigningKey() {
  const raw = process.env.CANVAS_LTI_PRIVATE_KEY_JWK?.trim();
  if (!raw) {
    throw new Error("CANVAS_LTI_PRIVATE_KEY_JWK is not configured on the server.");
  }
  const jwk = JSON.parse(raw) as JsonWebKey;
  return importJWK(jwk, "RS256");
}

export async function buildDeepLinkingResponse(params: {
  clientId: string;
  platformIssuer: string;
  nonce: string;
  launchUrl: string;
  data?: string;
  config?: CourseAlertConfigInput;
}) {
  const key = await getSigningKey();
  const now = Math.floor(Date.now() / 1000);
  const custom = params.config ? serializeCourseAlertCustomFields(params.config) : undefined;

  const payload: JWTPayload = {
    nonce: params.nonce,
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

  if (params.data) {
    payload[DATA_CLAIM] = params.data;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: process.env.CANVAS_LTI_KID || "student-alerts-2026" })
    .setIssuer(params.clientId)
    .setAudience(params.platformIssuer)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);
}

export function buildDeepLinkingHtml(returnUrl: string, jwt: string) {
  const escapedUrl = returnUrl.replace(/"/g, "&quot;");
  const escapedJwt = jwt.replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Adding Student Alerts</title></head>
  <body style="font-family:sans-serif;padding:24px">
    <p>Adding Student Alerts to your page...</p>
    <form id="deep-link-form" method="POST" action="${escapedUrl}">
      <input type="hidden" name="JWT" value="${escapedJwt}" />
    </form>
    <script>document.getElementById("deep-link-form").submit();</script>
  </body>
</html>`;
}
