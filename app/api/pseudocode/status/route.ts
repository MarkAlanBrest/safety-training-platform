import { createPseudocodeCoach } from "@/lib/pseudocode/coach";

export const dynamic = "force-dynamic";

const coach = createPseudocodeCoach();

export function GET() {
  return coach.status();
}
