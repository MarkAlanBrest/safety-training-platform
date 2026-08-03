export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = String(body.text || "").trim().slice(0, 4096);
    const voice =
      typeof body.voice === "string" && body.voice.trim()
        ? body.voice.trim()
        : process.env.MASON_VOICE || "cedar";
    const speed = Math.min(1.25, Math.max(0.75, Number(body.speed) || 0.96));
    if (!input) {
      return Response.json({ error: "Speech text is required." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 },
      );
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
        instructions:
          "Speak as a warm, clear instructor guiding someone through a training picture. Sound natural and conversational—not like a radio announcer. Pause briefly between ideas, emphasize key safety terms, and vary your pace so each sentence is easy to follow. When describing what to look at on a diagram, use inviting language like 'notice here' or 'look at this part'.",
        response_format: "mp3",
        speed,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Instructor speech generation failed:", error);
      return Response.json(
        { error: "Instructor audio could not be generated." },
        { status: response.status },
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Instructor speech route failed:", error);
    return Response.json(
      { error: "Instructor audio could not be generated." },
      { status: 500 },
    );
  }
}
