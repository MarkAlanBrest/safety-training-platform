import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const TTS_INSTRUCTIONS =
  "Speak as a warm, clear instructor guiding someone through a training picture. Sound natural and conversational—not like a radio announcer. Pause briefly between ideas, emphasize key safety terms, and vary your pace so each sentence is easy to follow. When describing what to look at on a diagram, use inviting language like 'notice here' or 'look at this part'.";

export const MAX_SPEECH_INPUT_LENGTH = 4096;

export function parseVoice(raw: string | null | undefined) {
  return raw && raw.trim() ? raw.trim() : process.env.MASON_VOICE || "cedar";
}

export function parseSpeed(raw: string | number | null | undefined) {
  return Math.min(1.25, Math.max(0.75, Number(raw) || 0.96));
}

export async function synthesizeSpeechBuffer(
  input: string,
  voice: string,
  speed: number,
): Promise<Buffer> {
  const text = input.trim().slice(0, MAX_SPEECH_INPUT_LENGTH);
  if (!text) {
    throw new Error("Speech text is required.");
  }

  const hash = crypto.createHash("sha256").update(`${voice}|${speed}|${text}`).digest("hex");

  try {
    const cached = await prisma.speechCache.findUnique({ where: { hash } });
    if (cached) {
      void prisma.speechCache
        .update({ where: { hash }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
      return Buffer.from(cached.audio);
    }
  } catch (cacheError) {
    console.error("Speech cache lookup failed:", cacheError);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
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
      input: text,
      instructions: TTS_INSTRUCTIONS,
      response_format: "mp3",
      speed,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Instructor speech generation failed:", error);
    throw new Error("Instructor audio could not be generated.");
  }

  const audio = Buffer.from(await response.arrayBuffer());
  try {
    await prisma.speechCache.upsert({
      where: { hash },
      create: { hash, voice, speed, mimeType: "audio/mpeg", audio },
      update: { audio, mimeType: "audio/mpeg", lastUsedAt: new Date() },
    });
  } catch (cacheError) {
    console.error("Speech cache save failed:", cacheError);
  }

  return audio;
}
