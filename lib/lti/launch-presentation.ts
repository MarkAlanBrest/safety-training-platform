import type { JWTPayload } from "jose";

const LTI_LAUNCH_PRESENTATION_CLAIM =
  "https://purl.imsglobal.org/spec/lti/claim/launch_presentation";

export function isIframeLtiLaunch(payload: JWTPayload) {
  const claim = payload[LTI_LAUNCH_PRESENTATION_CLAIM];
  if (!claim || typeof claim !== "object") return false;

  const target = String((claim as { document_target?: string }).document_target || "").toLowerCase();
  return target === "iframe" || target === "embed" || target === "borderless";
}
