import type { ClassroomQuestion } from "@/lib/classroom-question-types";

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function gradeVideoCueAnswer(
  question: ClassroomQuestion,
  answer: string,
): { correct: boolean; feedback?: string } {
  switch (question.type) {
    case "multipleChoice":
      return {
        correct: normalizeText(answer) === normalizeText(question.correctChoice),
        feedback: question.explanation,
      };
    case "trueFalse": {
      const normalized = normalizeText(answer);
      const expected = question.correctAnswer ? "true" : "false";
      return {
        correct: normalized === expected,
        feedback: question.explanation,
      };
    }
    case "shortAnswer": {
      const normalizedAnswer = normalizeText(answer);
      const sample = normalizeText(question.sampleAnswer);
      const correct = Boolean(
        normalizedAnswer === sample
        || (sample.length >= 4 && normalizedAnswer.includes(sample))
        || question.keyPoints?.some((point) => normalizedAnswer.includes(normalizeText(point))),
      );
      return {
        correct,
        feedback: question.explanation || `Sample answer: ${question.sampleAnswer}`,
      };
    }
    case "scenario":
      if (question.responseMode === "shortAnswer") {
        const normalizedAnswer = normalizeText(answer);
        const sample = normalizeText(question.sampleAnswer);
        const correct = Boolean(
          normalizedAnswer === sample
          || (sample.length >= 4 && normalizedAnswer.includes(sample))
          || question.keyPoints?.some((point) => normalizedAnswer.includes(normalizeText(point))),
        );
        return {
          correct,
          feedback: question.explanation || `Sample answer: ${question.sampleAnswer}`,
        };
      }
      return {
        correct: normalizeText(answer) === normalizeText(question.correctChoice),
        feedback: question.explanation,
      };
    case "dragDrop":
    case "flashcard":
    case "hotspot":
      return { correct: true, feedback: question.explanation };
    default:
      return { correct: false };
  }
}
