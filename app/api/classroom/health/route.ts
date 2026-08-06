export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return Response.json({
    aiConfigured: Boolean(apiKey),
  });
}
