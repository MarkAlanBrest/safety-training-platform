import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { getLtiConfig } from "@/lib/canvas/config";

const LTI_NONCE_COOKIE = "canvas-lti-nonce";
const LTI_CUSTOM_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/custom";
const LTI_DEPLOYMENT_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/deployment_id";

export type LtiLaunchIdentity = {
  userId: number;
  name: string;
  email: string | null;
  deploymentId: string | null;
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

export async function getOidcConfig(issuer: string) {
  const normalized = normalizeIssuer(issuer);
  const cached = oidcCache.get(normalized);
  if (cached) return cached;

  const discoveryUrl = `${normalized}/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load Canvas OIDC config from ${discoveryUrl}.`);
  }

  const config = (await response.json()) as OidcConfig;
  oidcCache.set(normalized, config);
  return config;
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
  const authorizeBase = `${normalizeIssuer(params.issuer)}/api/lti/authorize_redirect`;
  const url = new URL(authorizeBase);
  url.searchParams.set("scope", "openid");
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.targetLinkUri);
  url.searchParams.set("login_hint", params.loginHint);
  url.searchParams.set("lti_message_hint", params.ltiMessageHint);
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

export async function verifyLtiIdToken(idToken: string, issuer: string, expectedNonce: string) {
  const { clientId } = getLtiConfig();
  const oidc = await getOidcConfig(issuer);
  const jwks = createRemoteJWKSet(new URL(oidc.jwks_uri));

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: oidc.issuer,
    audience: clientId,
    clockTolerance: 30,
  });

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

  return {
    userId,
    name: typeof payload.name === "string" ? payload.name : "Student",
    email: typeof payload.email === "string" ? payload.email : null,
    deploymentId: typeof deploymentClaim === "string" ? deploymentClaim : null,
  } satisfies LtiLaunchIdentity;
}

export { LTI_NONCE_COOKIE };
