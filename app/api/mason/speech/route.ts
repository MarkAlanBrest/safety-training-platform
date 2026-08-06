export const runtime = "nodejs";

import crypto from "crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

const TTS_INSTRUCTIONS =
  "Speak as a warm, clear instructor guiding someone through a training picture. Sound natural and conversational—not like a radio announcer. Pause briefly between ideas, emphasize key safety terms, and vary your pace so each sentence is easy to follow. When describing what to look at on a diagram, use inviting language like 'notice here' or 'look at this part'.";

function parseVoice(raw: string | null | undefined) {
  return raw && raw.trim() ? raw.trim() : process.env.MASON_VOICE || "cedar";
}

function parseSpeed(raw: string | number | null | undefined) {
  return Math.min(1.25, Math.max(0.75, Number(raw) || 0.96));
}

async function synthesizeSpeech(input: string, voice: string, speed: number): Promise<Response> {
  if (!input) {
    return Response.json({ error: "Speech text is required." }, { status: 400 });
  }

  // Cache key is the exact spoken text + voice + speed — identical narration (the
  // welcome message every student hears, a replayed line, repeated feedback) is
  // served from cache instead of paying to re-synthesize it every time.
  const hash = crypto.createHash("sha256").update(`${voice}|${speed}|${input}`).digest("hex");

  try {
    const cached = await prisma.speechCache.findUnique({ where: { hash } });
    if (cached) {
      after(() =>
        prisma.speechCache
          .update({ where: { hash }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined),
      );
      return new Response(cached.audio, {
        headers: {
          "Content-Type": cached.mimeType,
          "Cache-Control": "private, max-age=86400",
          "X-Speech-Cache": "hit",
        },
      });
    }
  } catch (cacheError) {
    console.error("Speech cache lookup failed:", cacheError);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice,
      input,
      instructions: TTS_INSTRUCTIONS,
      response_format: "mp3",
      speed,
    }),
  });

  if (!response.ok || !response.body) {
    const error = await response.text();
    console.error("Instructor speech generation failed:", error);
    return Response.json(
      { error: "Instructor audio could not be generated." },
      { status: response.status },
    );
  }

  const mimeType = "audio/mpeg";
  // Split the stream: one branch goes straight to the client — as a real HTTP response
  // (not buffered into a blob first), so an <audio src> element can start playing as
  // bytes arrive instead of waiting for the whole clip. The other branch is collected
  // after the response is sent and saved to the cache for next time.
  const [clientStream, cacheStream] = response.body.tee();

  after(async () => {
    try {
      const reader = cacheStream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const audio = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
      await prisma.speechCache.upsert({
        where: { hash },
        create: { hash, voice, speed, mimeType, audio },
        update: { audio, mimeType, lastUsedAt: new Date() },
      });
    } catch (cacheError) {
      console.error("Speech cache save failed:", cacheError);
    }
  });

  return new Response(clientStream, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=86400",
      "X-Speech-Cache": "miss",
      "Accept-Ranges": "none",
    },
  });
}

/** GET so `<audio src>` can request it directly — the browser then streams/plays
 * progressively on its own, which is far simpler and more reliable than any custom
 * client-side buffering code. Used for normal-length narration. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = (url.searchParams.get("text") || "").trim().slice(0, 4096);
    const voice = parseVoice(url.searchParams.get("voice"));
    const speed = parseSpeed(url.searchParams.get("speed"));
    return await synthesizeSpeech(input, voice, speed);
  } catch (error) {
    console.error("Instructor speech route failed:", error);
    return Response.json(
      { error: "Instructor audio could not be generated." },
      { status: 500 },
    );
  }
}

/** POST kept for callers that can't use a GET URL (e.g. text too long to fit a query string). */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = String(body.text || "").trim().slice(0, 4096);
    const voice = parseVoice(body.voice);
    const speed = parseSpeed(body.speed);
    return await synthesizeSpeech(input, voice, speed);
  } catch (error) {
    console.error("Instructor speech route failed:", error);
    return Response.json(
      { error: "Instructor audio could not be generated." },
      { status: 500 },
    );
  }
}
