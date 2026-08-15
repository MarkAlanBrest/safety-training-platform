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

export function getToolPublicJwk(): ToolPublicJwk {
  const configPath = join(process.cwd(), "public", "canvas-lti-public-jwk.json");
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as
    | ToolPublicJwk
    | { keys: ToolPublicJwk[] };

  if ("keys" in raw && Array.isArray(raw.keys) && raw.keys[0]) {
    return raw.keys[0];
  }

  return raw as ToolPublicJwk;
}

export function getToolJwks() {
  return { keys: [getToolPublicJwk()] };
}

export function getToolKid() {
  return process.env.CANVAS_LTI_KID?.trim() || getToolPublicJwk().kid || "student-alerts-2026";
}

function parsePrivateKeyEnv(raw: string) {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = JSON.parse(value) as string;
  }
  return JSON.parse(value) as JsonWebKey;
}

export async function importToolPrivateKey() {
  const { importJWK } = await import("jose");
  const raw = process.env.CANVAS_LTI_PRIVATE_KEY_JWK?.trim();
  if (!raw) {
    throw new Error("CANVAS_LTI_PRIVATE_KEY_JWK is not configured on the server.");
  }

  try {
    return importJWK(parsePrivateKeyEnv(raw), "RS256");
  } catch {
    throw new Error("CANVAS_LTI_PRIVATE_KEY_JWK is not valid JSON.");
  }
}
