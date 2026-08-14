export function getCanvasServerConfig() {
  const baseUrl = process.env.CANVAS_BASE_URL?.trim() || "";
  const apiToken = process.env.CANVAS_API_TOKEN?.trim() || "";

  if (!baseUrl || !apiToken) {
    throw new Error("CANVAS_BASE_URL and CANVAS_API_TOKEN must be configured on the server.");
  }

  return { baseUrl, apiToken };
}

export function getLtiConfig() {
  const clientId = process.env.CANVAS_LTI_CLIENT_ID?.trim() || "";
  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim().replace(/\/+$/, "") || "";

  if (!clientId || !appOrigin) {
    throw new Error("CANVAS_LTI_CLIENT_ID and NEXT_PUBLIC_APP_ORIGIN must be configured.");
  }

  return {
    clientId,
    appOrigin,
    loginUrl: `${appOrigin}/api/lti/login`,
    launchUrl: `${appOrigin}/api/lti/launch`,
    targetUrl: `${appOrigin}/canvas`,
  };
}

export function getDevCanvasUserId() {
  const raw = process.env.CANVAS_DEV_USER_ID?.trim();
  if (!raw || process.env.NODE_ENV === "production") return null;
  const userId = Number(raw);
  return Number.isFinite(userId) ? userId : null;
}
