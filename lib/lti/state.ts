import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type LtiStatePayload = {
  nonce: string;
  iss: string;
  exp: number;
};

function getStateSecret() {
  return (
    process.env.CANVAS_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.DATABASE_URL ||
    "canvas-dev-secret"
  );
}

export function createLtiState(iss: string, nonce: string) {
  const payload: LtiStatePayload = {
    nonce,
    iss,
    exp: Date.now() + 5 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function parseLtiState(state: string) {
  const [body, signature] = state.split(".");
  if (!body || !signature) {
    throw new Error("Invalid LTI state.");
  }

  const expected = createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid LTI state signature.");
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LtiStatePayload;
  if (!payload.nonce || !payload.iss || payload.exp < Date.now()) {
    throw new Error("LTI state expired. Reopen the tool from Canvas.");
  }

  return payload;
}

export function createLtiNonce() {
  return randomBytes(16).toString("hex");
}
