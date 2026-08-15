import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const LAUNCH_HANDOFF_TTL_MS = 12 * 60 * 60 * 1000;

export type LaunchHandoff = {
  userId: number;
  name: string;
  email: string | null;
  courseId: string | null;
  courseName: string | null;
  isInstructor: boolean;
  exp: number;
  nonce: string;
};

function getHandoffSecret() {
  return (
    process.env.CANVAS_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.DATABASE_URL ||
    "canvas-dev-secret"
  );
}

export function createLaunchHandoff(
  identity: Omit<LaunchHandoff, "exp" | "nonce">,
) {
  const payload: LaunchHandoff = {
    ...identity,
    nonce: randomBytes(8).toString("hex"),
    isInstructor: identity.isInstructor,
    exp: Date.now() + LAUNCH_HANDOFF_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getHandoffSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function parseLaunchHandoff(token: string): LaunchHandoff | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", getHandoffSecret()).update(body).digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LaunchHandoff;
  if (!payload?.userId || payload.exp < Date.now()) return null;
  return payload;
}

export function buildLaunchRedirectHtml(targetUrl: string) {
  const escaped = targetUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0;url=${escaped}" />
    <title>Opening Student Alerts</title>
  </head>
  <body style="font-family:sans-serif;padding:24px">
    <p>Opening Student Alerts...</p>
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
  </body>
</html>`;
}
