import { unzipSync } from "fflate";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_SLIDES = 60;

export type ParsedSlideImage = {
  bytes: Uint8Array;
  mimeType: string;
};

export type ParsedClassroomSlide = {
  index: number;
  title: string;
  bodyText: string;
  speakerNotes: string;
  image: ParsedSlideImage | null;
};

export function escapeXmlText(value: string) {
  return value.replace(/[<>&"]/g, "");
}

export function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractText(xml: string) {
  const chunks = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((match) =>
    decodeXml(match[1].replace(/<[^>]+>/g, "")).trim(),
  );
  return chunks.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function extractNotes(xml: string) {
  const notes = xml.match(/<p:notes[^>]*>([\s\S]*?)<\/p:notes>/i)?.[1] || xml;
  return extractText(notes);
}

export function mimeForPath(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function slideNumber(path: string) {
  const match = path.match(/slide(\d+)\.xml$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function placeholderSlideSvg(title: string, subtitle: string, index: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <rect width="960" height="540" fill="#f8fafc"/>
    <rect x="48" y="48" width="864" height="444" rx="24" fill="#ffffff" stroke="#cbd5e1"/>
    <text x="88" y="130" fill="#0f172a" font-family="Arial,sans-serif" font-size="34" font-weight="700">${escapeXmlText(title)}</text>
    <text x="88" y="190" fill="#475569" font-family="Arial,sans-serif" font-size="22">${escapeXmlText(subtitle)}</text>
    <text x="88" y="450" fill="#94a3b8" font-family="Arial,sans-serif" font-size="18">Slide ${index + 1}</text>
  </svg>`;
}

export function placeholderSlideDataUrl(title: string, subtitle: string, index: number) {
  const svg = placeholderSlideSvg(title, subtitle, index);
  return `data:image/svg+xml;base64,${bytesToBase64(new TextEncoder().encode(svg))}`;
}

export function parsePptxBuffer(
  buffer: Uint8Array,
  options?: { maxImageBytes?: number },
): ParsedClassroomSlide[] {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("PowerPoint files are limited to 25 MB.");
  }

  const unpacked = unzipSync(buffer);
  const slideEntries = Object.entries(unpacked)
    .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort(([a], [b]) => slideNumber(a) - slideNumber(b));

  if (!slideEntries.length) {
    throw new Error("No slides were found in this PowerPoint file.");
  }
  if (slideEntries.length > MAX_SLIDES) {
    throw new Error(`PowerPoint files are limited to ${MAX_SLIDES} slides.`);
  }

  const relCache = new Map<string, Record<string, string>>();
  function relationshipsFor(slidePath: string) {
    if (relCache.has(slidePath)) return relCache.get(slidePath)!;
    const relPath = slidePath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
    const relXml = unpacked[relPath] ? new TextDecoder().decode(unpacked[relPath]) : "";
    const map: Record<string, string> = {};
    for (const match of relXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      map[match[1]] = match[2];
    }
    relCache.set(slidePath, map);
    return map;
  }

  return slideEntries.map(([path, content], index) => {
    const xml = new TextDecoder().decode(content);
    const bodyText = extractText(xml);
    const notesPath = `ppt/notesSlides/notesSlide${slideNumber(path)}.xml`;
    const speakerNotes = unpacked[notesPath]
      ? extractNotes(new TextDecoder().decode(unpacked[notesPath]))
      : "";

    let image: ParsedSlideImage | null = null;
    const rels = relationshipsFor(path);
    const imageRel = Object.values(rels).find((target) =>
      /\.(png|jpe?g|gif|webp|svg)$/i.test(target),
    );
    if (imageRel) {
      const mediaPath = imageRel.startsWith("../")
        ? `ppt/${imageRel.replace(/^\.\.\//, "")}`
        : imageRel;
      const media = unpacked[mediaPath];
      if (
        media &&
        (!options?.maxImageBytes || media.byteLength <= options.maxImageBytes)
      ) {
        image = {
          bytes: media,
          mimeType: mimeForPath(mediaPath),
        };
      }
    }

    const title =
      bodyText.split(/[.!?]/)[0]?.trim().slice(0, 80) || `Slide ${index + 1}`;

    return {
      index,
      title,
      bodyText: bodyText || `Content from slide ${index + 1}.`,
      speakerNotes,
      image,
    };
  });
}
