import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const LTI_DEEP_LINK_COOKIE = "lti-deep-link";

type DeepLinkSession = {
  returnUrl: string;
  clientId: string;
  platformIssuer: string;
  deploymentId: string | null;
  nonce: string;
  courseId: string | null;
  courseName: string | null;
  data?: string;
  exp: number;
};

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

export function encodeDeepLinkSession(session: Omit<DeepLinkSession, "exp">) {
  const payload: DeepLinkSession = {
    ...session,
    exp: Date.now() + 10 * 60 * 1000,
  };
  return encryptPayload(JSON.stringify(payload));
}

export function decodeDeepLinkSession(encoded: string): DeepLinkSession | null {
  try {
    const session = JSON.parse(decryptPayload(encoded)) as DeepLinkSession;
    if (!session?.returnUrl || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export type { DeepLinkSession };
