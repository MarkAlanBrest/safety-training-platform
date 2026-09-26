import { createFeedbackHandler } from "@/lib/robot-logic/feedback";

export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = createFeedbackHandler();
