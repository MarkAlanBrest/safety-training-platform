import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from "jose";
import { collectCanvasIssuerCandidates, getCanvasBaseUrl, issuerResolutionHint, resolveCanvasIssuer } from "@/lib/lti/canvas-issuer";

const LTI_NONCE_COOKIE = "canvas-lti-nonce";
const LTI_CUSTOM_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/custom";
const LTI_DEPLOYMENT_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/deployment_id";

const LTI_CONTEXT_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/context";

export type LtiLaunchIdentity = {
  userId: number;
  name: string;
  email: string | null;
  deploymentId: string | null;
  courseId: string | null;
  courseName: string | null;
};

type OidcConfig = {
  authorization_endpoint: string;
  jwks_uri: string;
  issuer: string;
};

const oidcCache = new Map<string, OidcConfig>();

function normalizeIssuer(issuer: string) {
  return issuer.replace(/\/+$/, "");
}

async function fetchOidcConfig(issuer: string) {
  const normalized = normalizeIssuer(issuer);
  const discoveryUrl = `${normalized}/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load Canvas OIDC config from ${discoveryUrl}.`);
  }

  const config = (await response.json()) as OidcConfig;
  oidcCache.set(normalized, config);
  return config;
}

export async function getOidcConfig(
  issuer: string,
  options?: { idToken?: string; request?: Request },
) {
  const candidates = collectCanvasIssuerCandidates(issuer, options);

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    const cached = oidcCache.get(candidate);
    if (cached) return cached;

    try {
      return await fetchOidcConfig(candidate);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const hint = issuerResolutionHint(issuer);
  if (hint) {
    throw new Error(`${lastError?.message || "OIDC discovery failed."} ${hint}`);
  }

  throw lastError || new Error("Could not load Canvas OIDC config.");
}

export function buildAuthorizeRedirectUrl(params: {
  issuer: string;
  clientId: string;
  loginHint: string;
  ltiMessageHint: string;
  targetLinkUri: string;
  state: string;
  nonce: string;
}) {
  const authorizeBase = `${resolveCanvasIssuer(params.issuer)}/api/lti/authorize_redirect`;
  const url = new URL(authorizeBase);
  url.searchParams.set("scope", "openid");
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.targetLinkUri);
  url.searchParams.set("login_hint", params.loginHint);
  if (params.ltiMessageHint) {
    url.searchParams.set("lti_message_hint", params.ltiMessageHint);
  }
  url.searchParams.set("state", params.state);
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("prompt", "none");
  return url.toString();
}

function readCustomClaim(payload: JWTPayload) {
  const custom = payload[LTI_CUSTOM_CLAIM];
  if (!custom || typeof custom !== "object") return null;
  return custom as Record<string, unknown>;
}

function parseCanvasUserId(payload: JWTPayload) {
  const custom = readCustomClaim(payload);
  const customUserId = custom?.user_id ?? custom?.canvas_user_id;
  if (typeof customUserId === "string" && /^\d+$/.test(customUserId)) {
    return Number(customUserId);
  }
  if (typeof customUserId === "number") return customUserId;

  if (typeof payload.sub === "string" && /^\d+$/.test(payload.sub)) {
    return Number(payload.sub);
  }

  return null;
}

function parseCanvasCourseId(payload: JWTPayload) {
  const custom = readCustomClaim(payload);
  const customCourseId = custom?.course_id ?? custom?.canvas_course_id;
  if (typeof customCourseId === "string" && /^\d+$/.test(customCourseId)) {
    return customCourseId;
  }
  if (typeof customCourseId === "number") return String(customCourseId);

  const context = payload[LTI_CONTEXT_CLAIM];
  if (!context || typeof context !== "object") return null;
  const record = context as Record<string, unknown>;
  const rawId = record.id;
  if (typeof rawId === "string") {
    const urlMatch = rawId.match(/\/courses\/(\d+)(?:\/|$)/);
    if (urlMatch?.[1]) return urlMatch[1];
    if (/^\d+$/.test(rawId)) return rawId;
    const endMatch = rawId.match(/(\d+)$/);
    if (endMatch?.[1]) return endMatch[1];
    return rawId;
  }
  if (typeof rawId === "number") return String(rawId);
  return null;
}

function parseCanvasCourseName(payload: JWTPayload) {
  const context = payload[LTI_CONTEXT_CLAIM];
  if (!context || typeof context !== "object") return null;
  const record = context as Record<string, unknown>;
  if (typeof record.title === "string") return record.title;
  if (typeof record.label === "string") return record.label;
  return null;
}

const CANVAS_LTI_JWKS_URLS = [
  "https://sso.canvaslms.com/api/lti/security/jwks",
  "https://canvas.instructure.com/api/lti/security/jwks",
];

function getCanvasLtiJwksUrls() {
  const urls = [...CANVAS_LTI_JWKS_URLS];
  const baseUrl = getCanvasBaseUrl();
  if (baseUrl) urls.push(`${baseUrl}/api/lti/security/jwks`);
  return [...new Set(urls)];
}

function collectIssuerCandidates(
  issuerFromState: string,
  tokenPayload: JWTPayload,
  request?: Request,
) {
  const issuers = new Set<string>();
  if (typeof tokenPayload.iss === "string") issuers.add(normalizeIssuer(tokenPayload.iss));
  issuers.add("https://canvas.instructure.com");

  for (const candidate of collectCanvasIssuerCandidates(issuerFromState, {
    request,
  })) {
    issuers.add(candidate);
  }

  return [...issuers];
}

async function verifyCanvasLtiJwt(
  idToken: string,
  expectedClientId: string,
  issuerCandidates: string[],
) {
  let lastError: Error | null = null;

  for (const jwksUrl of getCanvasLtiJwksUrls()) {
    const jwks = createRemoteJWKSet(new URL(jwksUrl));
    for (const issuer of issuerCandidates) {
      try {
        return await jwtVerify(idToken, jwks, {
          issuer,
          audience: expectedClientId,
          clockTolerance: 30,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw lastError || new Error("Could not verify LTI id_token signature.");
}

export async function verifyLtiIdToken(
  idToken: string,
  issuerFromState: string,
  expectedNonce: string,
  expectedClientId: string,
  request?: Request,
) {
  let tokenPayload: JWTPayload;
  try {
    tokenPayload = decodeJwt(idToken);
  } catch {
    throw new Error("Invalid LTI id_token.");
  }

  const issuerCandidates = collectIssuerCandidates(issuerFromState, tokenPayload, request);
  const { payload } = await verifyCanvasLtiJwt(idToken, expectedClientId, issuerCandidates);

  if (payload.nonce !== expectedNonce) {
    throw new Error("LTI launch nonce did not match.");
  }

  const userId = parseCanvasUserId(payload);
  if (!userId) {
    throw new Error(
      "Canvas user id was not found in the LTI launch. Add custom field user_id=$Canvas.user.id to the developer key.",
    );
  }

  const deploymentClaim = payload[LTI_DEPLOYMENT_CLAIM];
  const platformIssuer =
    typeof payload.iss === "string" ? payload.iss : issuerCandidates[0] || "https://canvas.instructure.com";

  return {
    userId,
    name: typeof payload.name === "string" ? payload.name : "Student",
    email: typeof payload.email === "string" ? payload.email : null,
    deploymentId: typeof deploymentClaim === "string" ? deploymentClaim : null,
    courseId: parseCanvasCourseId(payload),
    courseName: parseCanvasCourseName(payload),
    platformIssuer,
    nonce: typeof payload.nonce === "string" ? payload.nonce : expectedNonce,
    payload,
  } satisfies LtiLaunchIdentity & {
    platformIssuer: string;
    nonce: string;
    payload: JWTPayload;
  };
}

export { LTI_NONCE_COOKIE };
