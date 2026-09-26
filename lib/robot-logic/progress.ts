export type Feedback = {
  mode: "ai" | "self-review";
  passed: boolean;
  summary: string;
  strengths: string[];
  improvements: string[];
  nextStep: string;
};

export type Progress = {
  drafts: Record<string, string>;
  quiz: Record<string, boolean>;
  passed: Record<string, boolean>;
  feedback: Record<string, Feedback>;
};

export function emptyProgress(): Progress {
  return { drafts: {}, quiz: {}, passed: {}, feedback: {} };
}

export function isFeedback(value: unknown): value is Feedback {
  if (!value || typeof value !== "object") return false;
  const f = value as Record<string, unknown>;
  return (f.mode === "ai" || f.mode === "self-review") &&
    typeof f.passed === "boolean" && typeof f.summary === "string" &&
    typeof f.nextStep === "string" && Array.isArray(f.strengths) &&
    Array.isArray(f.improvements) &&
    [...f.strengths, ...f.improvements].every(item => typeof item === "string");
}

export function readProgress(raw: string | null, ids: string[]): Progress {
  const result = emptyProgress();
  if (!raw) return result;
  try {
    const stored = JSON.parse(raw);
    for (const id of ids) {
      if (typeof stored?.drafts?.[id] === "string") result.drafts[id] = stored.drafts[id].slice(0, 6000);
      if (typeof stored?.quiz?.[id] === "boolean") result.quiz[id] = stored.quiz[id];
      if (isFeedback(stored?.feedback?.[id])) {
        result.feedback[id] = stored.feedback[id];
        result.passed[id] = stored.feedback[id].mode === "ai" && stored.feedback[id].passed;
      }
    }
  } catch { /* A damaged saved draft must not prevent opening the course. */ }
  return result;
}

export function editDraft(progress: Progress, id: string, answer: string): Progress {
  const next = { ...progress, drafts: { ...progress.drafts, [id]: answer },
    passed: { ...progress.passed }, feedback: { ...progress.feedback } };
  delete next.passed[id];
  delete next.feedback[id];
  return next;
}

export function recordReview(progress: Progress, id: string, answer: string, feedback: Feedback): Progress {
  if ((progress.drafts[id] || "").trim() !== answer.trim()) return progress;
  return { ...progress, feedback: { ...progress.feedback, [id]: feedback },
    passed: { ...progress.passed, [id]: feedback.mode === "ai" && feedback.passed } };
}
