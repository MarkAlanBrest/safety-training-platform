import { readFileSync } from "node:fs";
import { join } from "node:path";

export function getCanvasServerConfig() {
  const baseUrl = process.env.CANVAS_BASE_URL?.trim() || "";
  const apiToken = process.env.CANVAS_API_TOKEN?.trim() || "";

  if (!baseUrl || !apiToken) {
    throw new Error("CANVAS_BASE_URL and CANVAS_API_TOKEN must be configured on the server.");
  }

  return { baseUrl, apiToken };
}

function readAppOriginFromConfigFile() {
  try {
    const configPath = join(process.cwd(), "public", "canvas-lti-key.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      app_origin?: string;
      domain?: string;
    };
    const raw = config.app_origin || (config.domain ? `https://${config.domain}` : "");
    return raw.trim().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function getAppOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const fromConfig = readAppOriginFromConfigFile();
  if (fromConfig) return fromConfig;

  // Never use ephemeral VERCEL_URL for LTI — deployment URLs may require vercel.com SSO.
  return "";
}

export function getConfiguredLtiClientId() {
  return process.env.CANVAS_LTI_CLIENT_ID?.trim() || "";
}

export function getLtiConfig() {
  const appOrigin = getAppOrigin();
  if (!appOrigin) {
    throw new Error(
      "App origin is not configured. Set NEXT_PUBLIC_APP_ORIGIN in Vercel (e.g. https://safety-training-platform-eight.vercel.app).",
    );
  }

  return {
    clientId: getConfiguredLtiClientId(),
    appOrigin,
    loginUrl: `${appOrigin}/api/lti/login`,
    launchUrl: `${appOrigin}/api/lti/launch`,
    targetUrl: `${appOrigin}/canvas/alerts`,
  };
}

export function getDevCanvasUserId() {
  const raw = process.env.CANVAS_DEV_USER_ID?.trim();
  if (!raw || process.env.NODE_ENV === "production") return null;
  const userId = Number(raw);
  return Number.isFinite(userId) ? userId : null;
}
