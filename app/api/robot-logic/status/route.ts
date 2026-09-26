export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ai: Boolean(process.env.OPENAI_API_KEY) }, {
    headers: { "Cache-Control": "no-store" },
  });
}
