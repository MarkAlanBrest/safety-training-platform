import { clientIdFrom, createPseudocodeCoach } from "@/lib/pseudocode/coach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const coach = createPseudocodeCoach();

export function POST(request: Request) {
  return coach.check(request, clientIdFrom(request));
}
