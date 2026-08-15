import { writeFileSync } from "node:fs";
import { generateKeyPair, exportJWK } from "jose";

const kid = process.env.CANVAS_LTI_KID?.trim() || "student-alerts-2026";
const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
const privateJwk = await exportJWK(privateKey);
const publicJwk = await exportJWK(publicKey);

for (const jwk of [privateJwk, publicJwk]) {
  jwk.kid = kid;
  jwk.alg = "RS256";
  jwk.use = "sig";
}

writeFileSync(
  "public/canvas-lti-public-jwk.json",
  `${JSON.stringify({ keys: [publicJwk] }, null, 2)}\n`,
);
writeFileSync("canvas-lti-private-jwk.local.json", `${JSON.stringify(privateJwk)}\n`);

console.log("Wrote public/canvas-lti-public-jwk.json");
console.log("Wrote canvas-lti-private-jwk.local.json (do not commit)");
console.log("");
console.log("Next steps:");
console.log("1. Paste canvas-lti-private-jwk.local.json into Vercel env CANVAS_LTI_PRIVATE_KEY_JWK (one line)");
console.log("2. In Canvas developer key, set Public JWK URL to https://your-app.com/api/lti/jwks");
console.log("3. Set CANVAS_LTI_KID=" + kid);
