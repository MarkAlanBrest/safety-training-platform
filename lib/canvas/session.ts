import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readCookie } from "@/lib/admin-session";
import { createCanvasClient } from "@/lib/canvas/client";
import { getCanvasServerConfig, getDevCanvasUserId } from "@/lib/canvas/config";

export const CANVAS_SESSION_COOKIE = "canvas-session";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function getEncryptionKey() {
  const secret =
    process.env.CANVAS_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.DATABASE_URL ||
    "canvas-dev-secret";
  return createHash("sha256").update(secret).digest();
}

function encryptPayload(payload: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptPayload(encoded: string) {
  const buffer = Buffer.from(encoded, "base64url");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export type CanvasStudentSession = {
  userId: number;
  name: string;
  email: string | null;
  source: "lti" | "dev";
  connectedAt: string;
  expiresAt: string;
};

export function encodeCanvasStudentSession(session: Omit<CanvasStudentSession, "connectedAt" | "expiresAt">) {
  const now = Date.now();
  const payload: CanvasStudentSession = {
    ...session,
    connectedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
  return encryptPayload(JSON.stringify(payload));
}

export function decodeCanvasStudentSession(encoded: string): CanvasStudentSession | null {
  try {
    const session = JSON.parse(decryptPayload(encoded)) as CanvasStudentSession;
    if (!session?.userId) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function getCanvasStudentSession(request: Request): CanvasStudentSession | null {
  const encoded = readCookie(request, CANVAS_SESSION_COOKIE);
  if (encoded) {
    const session = decodeCanvasStudentSession(encoded);
    if (session) return session;
  }

  const devUserId = getDevCanvasUserId();
  if (!devUserId) return null;

  const now = Date.now();
  return {
    userId: devUserId,
    name: "Dev Student",
    email: null,
    source: "dev",
    connectedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
}

export function canvasSessionCookieOptions(expiresAt: Date) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "none" as const,
    secure: true,
    expires: expiresAt,
  };
}

export function createStudentCanvasClient(session: CanvasStudentSession) {
  const { baseUrl, apiToken } = getCanvasServerConfig();
  return createCanvasClient({
    baseUrl,
    token: apiToken,
    userId: session.userId,
  });
}
