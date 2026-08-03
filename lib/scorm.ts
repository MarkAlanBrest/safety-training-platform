import { unzipSync } from "fflate";
import path from "node:path";

export type ScormPackage = {
  version: "1.2" | "2004";
  entryPoint: string;
  assets: Array<{ path: string; mimeType: string; content: Uint8Array }>;
};

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

export function scormMimeType(filePath: string) {
  return MIME_TYPES[path.posix.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function safePath(value: string) {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/")).replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error("The package contains an unsafe file path.");
  }
  return normalized;
}

export function parseScormPackage(zip: Uint8Array): ScormPackage {
  const unpacked = unzipSync(zip);
  const entries = Object.entries(unpacked)
    .filter(([name]) => name && !name.endsWith("/") && !name.includes("__MACOSX"))
    .map(([name, content]) => ({ path: safePath(name), content }));

  if (!entries.length || entries.length > 1500) {
    throw new Error("The package must contain between 1 and 1,500 files.");
  }
  const totalSize = entries.reduce((total, asset) => total + asset.content.byteLength, 0);
  if (totalSize > 100 * 1024 * 1024) {
    throw new Error("The extracted SCORM package is limited to 100 MB.");
  }

  const manifestAsset = entries.find((asset) => asset.path.toLowerCase().endsWith("imsmanifest.xml"));
  if (!manifestAsset) throw new Error("No imsmanifest.xml file was found. Choose a valid SCORM package.");

  const manifest = new TextDecoder().decode(manifestAsset.content);
  const resourceTags = manifest.match(/<resource\b[^>]*>/gi) || [];
  const launchResource = resourceTags.find((tag) => /(?:adlcp:)?scormtype\s*=\s*["']sco["']/i.test(tag)) || resourceTags[0];
  const href = launchResource?.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!href) throw new Error("The SCORM manifest does not identify a launch file.");

  const manifestDirectory = path.posix.dirname(manifestAsset.path);
  const entryPoint = safePath(path.posix.join(manifestDirectory === "." ? "" : manifestDirectory, decodeXml(href).split(/[?#]/)[0]));
  if (!entries.some((asset) => asset.path === entryPoint)) {
    throw new Error(`The SCORM launch file (${entryPoint}) is missing from the package.`);
  }

  const version: "1.2" | "2004" = /2004|adlcp_v1p3|imsss:/i.test(manifest) ? "2004" : "1.2";
  return {
    version,
    entryPoint,
    assets: entries.map((asset) => ({ ...asset, mimeType: scormMimeType(asset.path) })),
  };
}
