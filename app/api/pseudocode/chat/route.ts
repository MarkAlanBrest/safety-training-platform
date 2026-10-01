import { createPseudocodeCoach } from "@/lib/pseudocode/coach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const coach = createPseudocodeCoach();

export function POST(request: Request) {
  const clientId = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return coach.chat(request, clientId);
}
