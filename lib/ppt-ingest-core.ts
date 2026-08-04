import { unzipSync } from "fflate";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_SLIDES = 60;

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i;

export type ParsedSlideImage = {
  bytes: Uint8Array;
  mimeType: string;
  label?: string;
};

export type ParsedClassroomSlide = {
  index: number;
  title: string;
  bodyText: string;
  speakerNotes: string;
  bullets: string[];
  image: ParsedSlideImage | null;
  images: ParsedSlideImage[];
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

export function extractText(xml: string) {
  const chunks = [
    ...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g),
  ].map((match) => decodeXml(match[1].replace(/<[^>]+>/g, "")).trim());

  return [...new Set(chunks)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
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
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  return "application/octet-stream";
}

function slideNumber(path: string) {
  const match = path.match(/slide(\d+)\.xml$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function parseRelationships(relXml: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const match of relXml.matchAll(/<Relationship\b([^>]*?)(?:\/>|>)/g)) {
    const attrs = match[1];
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) map[id] = target;
  }
  return map;
}

export function resolveMediaPath(target: string, sourcePath: string): string {
  const decoded = decodeURIComponent(target);
  if (decoded.startsWith("/")) return decoded.slice(1);

  const sourceParts = sourcePath.split("/");
  sourceParts.pop();
  const parts = [...sourceParts, ...decoded.split("/")];
  const normalized: string[] = [];
  for (const part of parts) {
    if (part === "..") normalized.pop();
    else if (part && part !== ".") normalized.push(part);
  }
  return normalized.join("/");
}

function isImageTarget(target: string) {
  return IMAGE_EXTENSIONS.test(target);
}

function extractEmbeddedImageIds(xml: string) {
  return [
    ...xml.matchAll(/\br:embed="([^"]+)"/g),
    ...xml.matchAll(/\br:link="([^"]+)"/g),
  ].map((match) => match[1]);
}

function collectImageTargets(
  xml: string,
  rels: Record<string, string>,
  options?: { includeAllRelationships?: boolean },
) {
  const targets = new Set<string>();
  for (const id of extractEmbeddedImageIds(xml)) {
    const target = rels[id];
    if (target && isImageTarget(target)) targets.add(target);
  }
  if (options?.includeAllRelationships) {
    for (const target of Object.values(rels)) {
      if (isImageTarget(target)) targets.add(target);
    }
  }
  return [...targets];
}

function extractImagesFromSlideXml(
  xml: string,
  rels: Record<string, string>,
  slidePath: string,
  unpacked: Record<string, Uint8Array>,
  maxImageBytes: number | undefined,
): ParsedSlideImage[] {
  const images: ParsedSlideImage[] = [];
  const seenPaths = new Set<string>();

  for (const target of collectImageTargets(xml, rels)) {
    const mediaPath = resolveMediaPath(target, slidePath);
    if (seenPaths.has(mediaPath)) continue;
    seenPaths.add(mediaPath);
    const media = unpacked[mediaPath];
    if (!media) continue;
    if (maxImageBytes && media.byteLength > maxImageBytes) continue;
    images.push({
      bytes: media,
      mimeType: mimeForPath(mediaPath),
    });
  }

  return images;
}

function extractImagesFromRelatedParts(
  xml: string,
  rels: Record<string, string>,
  sourcePath: string,
  unpacked: Record<string, Uint8Array>,
  maxImageBytes: number | undefined,
  getRelationships: (path: string) => Record<string, string>,
): ParsedSlideImage[] {
  const images: ParsedSlideImage[] = [];
  const seenPaths = new Set<string>();

  function addFromXml(
    partXml: string,
    partPath: string,
    partRels: Record<string, string>,
    includeAllRelationships = false,
  ) {
    for (const target of collectImageTargets(partXml, partRels, { includeAllRelationships })) {
      const mediaPath = resolveMediaPath(target, partPath);
      if (seenPaths.has(mediaPath)) continue;
      seenPaths.add(mediaPath);
      const media = unpacked[mediaPath];
      if (!media) continue;
      if (maxImageBytes && media.byteLength > maxImageBytes) continue;
      images.push({
        bytes: media,
        mimeType: mimeForPath(mediaPath),
      });
    }
  }

  addFromXml(xml, sourcePath, rels, true);

  const layoutTarget = Object.values(rels).find((target) =>
    /\/slideLayouts\/slideLayout\d+\.xml$/i.test(target),
  );
  if (layoutTarget) {
    const layoutPath = resolveMediaPath(layoutTarget, sourcePath);
    const layoutContent = unpacked[layoutPath];
    if (layoutContent) {
      const layoutXml = new TextDecoder().decode(layoutContent);
      const layoutRels = getRelationships(layoutPath);
      addFromXml(layoutXml, layoutPath, layoutRels, true);

      const masterTarget = Object.values(layoutRels).find((target) =>
        /\/slideMasters\/slideMaster\d+\.xml$/i.test(target),
      );
      if (masterTarget) {
        const masterPath = resolveMediaPath(masterTarget, layoutPath);
        const masterContent = unpacked[masterPath];
        if (masterContent) {
          const masterXml = new TextDecoder().decode(masterContent);
          const masterRels = getRelationships(masterPath);
          addFromXml(masterXml, masterPath, masterRels, true);
        }
      }
    }
  }

  return images;
}

function pickBestSlideImage(images: ParsedSlideImage[]) {
  if (!images.length) return null;
  const sorted = [...images].sort((a, b) => b.bytes.byteLength - a.bytes.byteLength);
  const meaningful = sorted.find((image) => image.bytes.byteLength >= 4 * 1024);
  return meaningful || sorted[0];
}

function labelSlideImages(images: ParsedSlideImage[], bullets: string[], title: string) {
  if (!images.length) return images;
  const labels = [title, ...bullets].filter(Boolean);
  if (labels.length <= 1) return images;

  return images.map((image, index) => ({
    ...image,
    label: labels[Math.min(index, labels.length - 1)],
  }));
}

function extractSlideImages(
  xml: string,
  rels: Record<string, string>,
  slidePath: string,
  unpacked: Record<string, Uint8Array>,
  maxImageBytes: number | undefined,
  getRelationships: (path: string) => Record<string, string>,
  bullets: string[],
  title: string,
): ParsedSlideImage[] {
  const slideImages = extractImagesFromSlideXml(
    xml,
    rels,
    slidePath,
    unpacked,
    maxImageBytes,
  );
  if (slideImages.length) {
    return labelSlideImages(slideImages, bullets, title);
  }

  const fallbackImages = extractImagesFromRelatedParts(
    xml,
    rels,
    slidePath,
    unpacked,
    maxImageBytes,
    getRelationships,
  );
  return labelSlideImages(fallbackImages, bullets, title);
}

function extractDiagramText(
  rels: Record<string, string>,
  slidePath: string,
  unpacked: Record<string, Uint8Array>,
) {
  const diagramTargets = Object.values(rels).filter((target) =>
    /\/diagrams\/data\d+\.xml$/i.test(target),
  );
  const chunks = diagramTargets
    .map((target) => {
      const diagramPath = resolveMediaPath(target, slidePath);
      const content = unpacked[diagramPath];
      if (!content) return "";
      return extractText(new TextDecoder().decode(content));
    })
    .filter(Boolean);
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function extractLayoutText(
  rels: Record<string, string>,
  slidePath: string,
  unpacked: Record<string, Uint8Array>,
) {
  const layoutTarget = Object.values(rels).find((target) =>
    /\/slideLayouts\/slideLayout\d+\.xml$/i.test(target),
  );
  if (!layoutTarget) return "";

  const layoutPath = resolveMediaPath(layoutTarget, slidePath);
  const layoutContent = unpacked[layoutPath];
  if (!layoutContent) return "";

  return extractText(new TextDecoder().decode(layoutContent));
}

function mergeUniqueText(...parts: Array<string | undefined | null>) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    merged.push(trimmed);
  }
  return merged.join(" ").replace(/\s+/g, " ").trim();
}

export function extractParagraphs(xml: string) {
  const paragraphs = [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
    .map((match) => {
      const chunks = [
        ...match[1].matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g),
      ]
        .map((part) => decodeXml(part[1].replace(/<[^>]+>/g, "")).trim())
        .filter(Boolean);
      return chunks.join(" ").trim();
    })
    .filter(Boolean);
  return [...new Set(paragraphs)];
}

function bulletsFromParagraphs(paragraphs: string[], title: string, bodyText: string) {
  if (paragraphs.length > 1) {
    const [first, ...rest] = paragraphs;
    const titleMatchesFirst =
      first.toLowerCase() === title.toLowerCase() || title.startsWith(first.slice(0, 40));
    return titleMatchesFirst ? rest.slice(0, 6) : paragraphs.slice(0, 6);
  }

  return bodyText
    .replace(title, "")
    .split(/(?:•|;|\n|(?<=[.!?])\s+)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 8)
    .slice(0, 6);
}

function deriveTitle(
  bodyText: string,
  speakerNotes: string,
  index: number,
  paragraphs: string[],
) {
  const fromParagraph = paragraphs[0]?.slice(0, 80).trim();
  if (fromParagraph) return fromParagraph;
  const fromBody = bodyText.split(/[.!?]/)[0]?.trim().slice(0, 80);
  if (fromBody) return fromBody;
  const fromNotes = speakerNotes.split(/[.!?]/)[0]?.trim().slice(0, 80);
  if (fromNotes) return fromNotes;
  return `Slide ${index + 1}`;
}

function deriveBodyText(
  bodyText: string,
  speakerNotes: string,
  hasImage: boolean,
  index: number,
) {
  if (bodyText) return bodyText;
  if (speakerNotes) return speakerNotes;
  if (hasImage) return `Visual slide ${index + 1}.`;
  return `Content from slide ${index + 1}.`;
}

function wrapSvgText(text: string, maxChars = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const words = normalized.slice(0, maxChars).split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 42 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= 5) break;
  }
  if (current && lines.length < 6) lines.push(current);
  return lines;
}

export function placeholderSlideSvg(title: string, subtitle: string, index: number) {
  const bodyLines = wrapSvgText(subtitle);
  const bodyMarkup = bodyLines
    .map(
      (line, lineIndex) =>
        `<text x="88" y="${250 + lineIndex * 34}" fill="#334155" font-family="Arial,sans-serif" font-size="20">${escapeXmlText(line)}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <rect width="960" height="540" fill="#f8fafc"/>
    <rect x="48" y="48" width="864" height="444" rx="24" fill="#ffffff" stroke="#cbd5e1"/>
    <text x="88" y="130" fill="#0f172a" font-family="Arial,sans-serif" font-size="34" font-weight="700">${escapeXmlText(title)}</text>
    ${bodyMarkup}
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
  function relationshipsFor(partPath: string) {
    if (relCache.has(partPath)) return relCache.get(partPath)!;
    const relPath = partPath.includes("/slides/")
      ? partPath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels"
      : partPath.includes("/slideLayouts/")
        ? partPath.replace("ppt/slideLayouts/", "ppt/slideLayouts/_rels/") + ".rels"
        : partPath.replace("ppt/slideMasters/", "ppt/slideMasters/_rels/") + ".rels";
    const relXml = unpacked[relPath] ? new TextDecoder().decode(unpacked[relPath]) : "";
    const map = parseRelationships(relXml);
    relCache.set(partPath, map);
    return map;
  }

  return slideEntries.map(([path, content], index) => {
    const xml = new TextDecoder().decode(content);
    const rels = relationshipsFor(path);
    const paragraphs = extractParagraphs(xml);
    const slideText = extractText(xml);
    const diagramText = extractDiagramText(rels, path, unpacked);
    const layoutText = slideText ? "" : extractLayoutText(rels, path, unpacked);
    const notesPath = `ppt/notesSlides/notesSlide${slideNumber(path)}.xml`;
    const speakerNotes = unpacked[notesPath]
      ? extractNotes(new TextDecoder().decode(unpacked[notesPath]))
      : "";

    const bodyText = mergeUniqueText(slideText, diagramText, layoutText);
    const title = deriveTitle(bodyText, speakerNotes, index, paragraphs);
    const bullets = bulletsFromParagraphs(paragraphs, title, bodyText);
    const images = extractSlideImages(
      xml,
      rels,
      path,
      unpacked,
      options?.maxImageBytes,
      relationshipsFor,
      bullets,
      title,
    );
    const image = pickBestSlideImage(images);

    return {
      index,
      title,
      bodyText: deriveBodyText(bodyText, speakerNotes, Boolean(image), index),
      speakerNotes,
      bullets,
      image,
      images,
    };
  });
}
