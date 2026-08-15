import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ToolPublicJwk = {
  kty: string;
  n: string;
  e: string;
  kid: string;
  alg: string;
  use: string;
};

function parsePrivateKeyJson(raw: string) {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = JSON.parse(value) as string;
  }
  return JSON.parse(value) as JsonWebKey & { kid?: string };
}

function readPrivateKeyRaw() {
  const fromEnv = process.env.CANVAS_LTI_PRIVATE_KEY_JWK?.trim();
  if (fromEnv) return fromEnv;
  try {
    return readFileSync(join(process.cwd(), "canvas-lti-private-jwk.local.json"), "utf8");
  } catch {
    return "";
  }
}

function publicJwkFromPrivate(jwk: JsonWebKey & { kid?: string }): ToolPublicJwk | null {
  if (!jwk.n || !jwk.e) return null;
  return {
    kty: typeof jwk.kty === "string" ? jwk.kty : "RSA",
    n: jwk.n,
    e: jwk.e,
    kid: process.env.CANVAS_LTI_KID?.trim() || jwk.kid || "student-alerts-2026",
    alg: "RS256",
    use: "sig",
  };
}

function publicJwkFromFile(): ToolPublicJwk {
  const configPath = join(process.cwd(), "public", "canvas-lti-public-jwk.json");
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as
    | ToolPublicJwk
    | { keys: ToolPublicJwk[] };

  if ("keys" in raw && Array.isArray(raw.keys) && raw.keys[0]) {
    return raw.keys[0];
  }

  return raw as ToolPublicJwk;
}

export function getToolPublicJwk(): ToolPublicJwk {
  const raw = readPrivateKeyRaw();
  if (raw) {
    try {
      const fromPrivate = publicJwkFromPrivate(parsePrivateKeyJson(raw));
      if (fromPrivate) return fromPrivate;
    } catch {
      // Fall back to the committed public JWK.
    }
  }
  return publicJwkFromFile();
}

export function getToolJwks() {
  return { keys: [getToolPublicJwk()] };
}

export function getToolKid() {
  return process.env.CANVAS_LTI_KID?.trim() || getToolPublicJwk().kid || "student-alerts-2026";
}

export async function importToolPrivateKey() {
  const { importJWK } = await import("jose");
  const raw = readPrivateKeyRaw();
  if (!raw) {
    throw new Error("CANVAS_LTI_PRIVATE_KEY_JWK is not configured on the server.");
  }

  try {
    return importJWK(parsePrivateKeyJson(raw), "RS256");
  } catch {
    throw new Error("CANVAS_LTI_PRIVATE_KEY_JWK is not valid JSON.");
  }
}
