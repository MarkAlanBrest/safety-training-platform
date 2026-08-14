import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readCookie } from "@/lib/admin-session";
import type { CanvasConfig } from "@/lib/canvas/types";

export const CANVAS_SESSION_COOKIE = "canvas-session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

export type CanvasSession = CanvasConfig & {
  connectedAt: string;
  expiresAt: string;
};

export function encodeCanvasSession(config: CanvasConfig) {
  const now = Date.now();
  const session: CanvasSession = {
    ...config,
    connectedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
  return encryptPayload(JSON.stringify(session));
}

export function decodeCanvasSession(encoded: string): CanvasSession | null {
  try {
    const session = JSON.parse(decryptPayload(encoded)) as CanvasSession;
    if (!session?.baseUrl || !session?.token) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function getCanvasSession(request: Request): CanvasSession | null {
  const encoded = readCookie(request, CANVAS_SESSION_COOKIE);
  if (!encoded) return null;
  return decodeCanvasSession(encoded);
}

export function canvasSessionCookieOptions(expiresAt: Date) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  };
}
