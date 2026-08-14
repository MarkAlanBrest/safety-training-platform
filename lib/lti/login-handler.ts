import { NextResponse } from "next/server";
import { getConfiguredLtiClientId } from "@/lib/canvas/config";
import { buildAuthorizeRedirectUrl } from "@/lib/lti/verify";
import { createLtiNonce, createLtiState } from "@/lib/lti/state";

export type LtiLoginParams = {
  iss: string;
  loginHint: string;
  targetLinkUri: string;
  ltiMessageHint: string;
  clientId: string;
};

function readLoginParamsFromSearchParams(searchParams: URLSearchParams): Partial<LtiLoginParams> {
  return {
    iss: searchParams.get("iss") || undefined,
    loginHint: searchParams.get("login_hint") || undefined,
    targetLinkUri: searchParams.get("target_link_uri") || undefined,
    ltiMessageHint: searchParams.get("lti_message_hint") || "",
    clientId: searchParams.get("client_id") || undefined,
  };
}

function readLoginParamsFromForm(form: FormData): Partial<LtiLoginParams> {
  return {
    iss: String(form.get("iss") || "") || undefined,
    loginHint: String(form.get("login_hint") || "") || undefined,
    targetLinkUri: String(form.get("target_link_uri") || "") || undefined,
    ltiMessageHint: String(form.get("lti_message_hint") || ""),
    clientId: String(form.get("client_id") || "") || undefined,
  };
}

export function handleLtiLoginParams(params: Partial<LtiLoginParams>) {
  const { iss, loginHint, targetLinkUri, clientId } = params;
  const ltiMessageHint = params.ltiMessageHint || "";

  if (!iss || !loginHint || !targetLinkUri || !clientId) {
    return NextResponse.json({ error: "Missing required LTI login parameters." }, { status: 400 });
  }

  const configuredClientId = getConfiguredLtiClientId();
  if (configuredClientId && clientId !== configuredClientId) {
    return NextResponse.json({ error: "Unexpected LTI client id." }, { status: 400 });
  }

  const nonce = createLtiNonce();
  const state = createLtiState(iss, nonce, clientId);

  const redirectUrl = buildAuthorizeRedirectUrl({
    issuer: iss,
    clientId,
    loginHint,
    ltiMessageHint,
    targetLinkUri,
    state,
    nonce,
  });

  return NextResponse.redirect(redirectUrl);
}

export function handleLtiLoginRequest(request: Request) {
  const url = new URL(request.url);
  return handleLtiLoginParams(readLoginParamsFromSearchParams(url.searchParams));
}

export async function handleLtiLoginPost(request: Request) {
  const form = await request.formData();

  const idToken = String(form.get("id_token") || "");
  const state = String(form.get("state") || "");
  if (idToken || state) {
    return { kind: "launch" as const, form };
  }

  const loginParams = readLoginParamsFromForm(form);
  if (loginParams.iss || loginParams.loginHint || loginParams.targetLinkUri || loginParams.clientId) {
    return { kind: "login" as const, response: handleLtiLoginParams(loginParams) };
  }

  return { kind: "error" as const };
}
