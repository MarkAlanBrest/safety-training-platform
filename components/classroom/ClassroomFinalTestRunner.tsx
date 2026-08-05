"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Award, CheckCircle2, Clock, LoaderCircle, XCircle } from "lucide-react";
import type { ClassroomFinalTest } from "@/lib/classroom-question-types";
import type { ClassroomQuestion } from "@/lib/classroom-question-types";
import { parseJsonResponse } from "@/lib/parse-response";

type Phase = "intro" | "inProgress" | "submitting" | "results";

type AnswerMap = Record<string, unknown>;

type SubmitResult = {
  score: number;
  passed: boolean;
  correctCount: number;
  total: number;
  certificateId: string | null;
  attemptId: number | null;
};

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function sampleQuestions(finalTest: ClassroomFinalTest): ClassroomQuestion[] {
  const { config, questionBank } = finalTest;
  const pool = config.includedTypes.length
    ? questionBank.filter((question) => config.includedTypes.includes(question.type))
    : questionBank;
  const ordered = config.randomizeQuestions ? shuffle(pool) : pool;
  return ordered.slice(0, Math.min(config.questionCount, ordered.length));
}

function QuestionInput({
  question,
  value,
  onChange,
  randomizeChoiceOrder,
}: {
  question: ClassroomQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  randomizeChoiceOrder: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  const choices = useMemo(() => {
    if (question.type === "multipleChoice") {
      return randomizeChoiceOrder ? shuffle(question.choices) : question.choices;
    }
    if (question.type === "scenario" && question.responseMode === "multipleChoice") {
      return randomizeChoiceOrder ? shuffle(question.choices) : question.choices;
    }
    return [];
  }, [question, randomizeChoiceOrder]);

  if (question.type === "multipleChoice" || (question.type === "scenario" && question.responseMode === "multipleChoice")) {
    return (
      <div className="space-y-2">
        {question.type === "scenario" ? (
          <p className="mb-3 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            {question.scenarioText}
          </p>
        ) : null}
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => onChange(choice)}
            className={`block w-full rounded-xl border px-4 py-3 text-left text-sm font-medium ${
              value === choice
                ? "border-[#c68b1b] bg-[#fff9eb] text-slate-900"
                : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
            }`}
          >
            {choice}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "trueFalse") {
    return (
      <div className="flex gap-3">
        {[true, false].map((option) => (
          <button
            key={String(option)}
            type="button"
            onClick={() => onChange(option)}
            className={`flex-1 rounded-xl border px-6 py-4 text-base font-bold ${
              value === option
                ? "border-[#c68b1b] bg-[#fff9eb] text-slate-900"
                : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
            }`}
          >
            {option ? "True" : "False"}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "dragDrop") {
    const order = (value as string[] | undefined) || question.dragItems;
    function move(from: number, to: number) {
      if (to < 0 || to >= order.length) return;
      const next = [...order];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    }
    return (
      <div className="space-y-2">
        {order.map((item, index) => (
          <div
            key={item}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <span>{item}</span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:opacity-30"
              >
                Up
              </button>
              <button
                type="button"
                disabled={index === order.length - 1}
                onClick={() => move(index, index + 1)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:opacity-30"
              >
                Down
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "hotspot") {
    const mark = value as { x: number; y: number } | undefined;
    return (
      <div
        ref={containerRef}
        onClick={(event) => {
          const bounds = containerRef.current?.getBoundingClientRect();
          if (!bounds) return;
          onChange({
            x: ((event.clientX - bounds.left) / bounds.width) * 100,
            y: ((event.clientY - bounds.top) / bounds.height) * 100,
          });
        }}
        className="relative max-h-[45vh] cursor-crosshair overflow-hidden rounded-xl border border-slate-200"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={question.imageUrl} alt={question.prompt} className="block w-full select-none" draggable={false} />
        {mark ? (
          <div
            className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#c68b1b] bg-white/80"
            style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
          />
        ) : null}
      </div>
    );
  }

  if (question.type === "flashcard") {
    return (
      <div className="space-y-3 text-center">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-lg font-semibold">
          {revealed ? question.back : question.front}
        </div>
        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            Show answer
          </button>
        ) : (
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onChange({ recalled: true })}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                (value as { recalled?: boolean } | undefined)?.recalled === true
                  ? "bg-emerald-600 text-white"
                  : "border border-emerald-300 text-emerald-700"
              }`}
            >
              I knew it
            </button>
            <button
              type="button"
              onClick={() => onChange({ recalled: false })}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                (value as { recalled?: boolean } | undefined)?.recalled === false
                  ? "bg-red-600 text-white"
                  : "border border-red-300 text-red-700"
              }`}
            >
              I missed it
            </button>
          </div>
        )}
      </div>
    );
  }

  // shortAnswer, or scenario with responseMode "shortAnswer"
  return (
    <div className="space-y-3">
      {question.type === "scenario" ? (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          {question.scenarioText}
        </p>
      ) : null}
      <textarea
        rows={4}
        value={(value as string) || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type your answer…"
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#c68b1b]"
      />
    </div>
  );
}

export default function ClassroomFinalTestRunner({
  courseSlug,
  finalTest,
  onExit,
}: {
  courseSlug: string;
  finalTest: ClassroomFinalTest;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [checkingAttempts, setCheckingAttempts] = useState(false);
  const [introError, setIntroError] = useState("");
  const [questions] = useState(() => sampleQuestions(finalTest));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    finalTest.config.timeLimitMinutes ? finalTest.config.timeLimitMinutes * 60 : null,
  );
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const startedAtRef = useRef<number>(0);

  const question = questions[questionIndex];

  useEffect(() => {
    if (phase !== "inProgress" || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      void handleSubmit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((current) => (current === null ? null : current - 1)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft]);

  async function handleStart() {
    setIntroError("");
    if (!studentName.trim() || !/\S+@\S+\.\S+/.test(studentEmail)) {
      setIntroError("Enter your name and a valid email to begin.");
      return;
    }
    setCheckingAttempts(true);
    try {
      const url = `/api/classroom/final-test/attempts?courseSlug=${encodeURIComponent(courseSlug)}&studentEmail=${encodeURIComponent(studentEmail.trim())}`;
      const response = await fetch(url);
      const data = await parseJsonResponse<{
        error?: string;
        attemptsRemaining: number | null;
      }>(response);
      if (!response.ok) throw new Error(data.error || "Could not check prior attempts.");
      if (data.attemptsRemaining === 0) {
        setIntroError("You have no attempts remaining for this final test.");
        return;
      }
      setAttemptsRemaining(data.attemptsRemaining);
      startedAtRef.current = Date.now();
      setPhase("inProgress");
    } catch (error) {
      setIntroError(error instanceof Error ? error.message : "Could not start the final test.");
    } finally {
      setCheckingAttempts(false);
    }
  }

  async function handleSubmit() {
    setPhase("submitting");
    setSubmitError("");
    try {
      const timeElapsedSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
      const response = await fetch("/api/classroom/final-test/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          studentEmail: studentEmail.trim(),
          studentName: studentName.trim(),
          timeElapsedSeconds,
          answers: questions.map((item) => ({ questionId: item.id, response: answers[item.id] })),
        }),
      });
      const data = await parseJsonResponse<SubmitResult & { error?: string }>(response);
      if (!response.ok) throw new Error((data as { error?: string }).error || "Submission failed.");
      setResult(data);
      setPhase("results");

      if (finalTest.config.aiReviewAfterSubmission && data.attemptId) {
        setReviewLoading(true);
        try {
          const reviewResponse = await fetch("/api/classroom/final-test/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId: data.attemptId }),
          });
          const reviewData = await parseJsonResponse<{ summary?: string; error?: string }>(reviewResponse);
          if (reviewResponse.ok && reviewData.summary) setReviewSummary(reviewData.summary);
        } finally {
          setReviewLoading(false);
        }
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Submission failed.");
      setPhase("inProgress");
    }
  }

  if (phase === "intro") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#0f2b46] to-[#163a5d] px-6 text-white">
        <div className="w-full max-w-md rounded-3xl bg-white/10 p-8 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-200">Final test</p>
          <h2 className="mt-3 text-2xl font-bold">
            {questions.length} question{questions.length === 1 ? "" : "s"}
            {finalTest.config.timeLimitMinutes ? ` · ${finalTest.config.timeLimitMinutes} min` : ""}
          </h2>
          <p className="mt-2 text-sm text-slate-200">
            Passing score: {finalTest.config.passingScore}%. Enter your name and email to begin.
          </p>
          <div className="mt-6 space-y-3">
            <input
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none"
            />
            <input
              value={studentEmail}
              onChange={(event) => setStudentEmail(event.target.value)}
              placeholder="Email"
              type="email"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none"
            />
          </div>
          {introError ? <p className="mt-3 text-sm font-semibold text-red-200">{introError}</p> : null}
          <button
            type="button"
            disabled={checkingAttempts}
            onClick={() => void handleStart()}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-[#10283f] disabled:opacity-60"
          >
            {checkingAttempts ? <LoaderCircle className="animate-spin" size={16} /> : null}
            Start final test
          </button>
        </div>
      </div>
    );
  }

  if (phase === "inProgress" || phase === "submitting") {
    if (!question) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-white px-6 text-center text-slate-600">
          This final test has no questions configured yet.
        </div>
      );
    }
    return (
      <div className="flex h-full w-full flex-col overflow-y-auto bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-2xl flex-1">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Question {questionIndex + 1} of {questions.length}
            </span>
            {secondsLeft !== null ? (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <Clock size={14} />
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-xl font-semibold leading-8 text-slate-900">{question.prompt}</p>
          <div className="mt-6">
            <QuestionInput
              question={question}
              value={answers[question.id]}
              onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
              randomizeChoiceOrder={finalTest.config.randomizeChoiceOrder}
            />
          </div>
          {submitError ? <p className="mt-4 text-sm font-semibold text-red-700">{submitError}</p> : null}
          <div className="mt-8 flex justify-between">
            <button
              type="button"
              disabled={questionIndex === 0}
              onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Back
            </button>
            {questionIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}
                className="rounded-full bg-[#10283f] px-5 py-2 text-sm font-semibold text-white"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={phase === "submitting"}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {phase === "submitting" ? <LoaderCircle className="animate-spin" size={16} /> : null}
                Submit final test
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "results" && result) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-slate-50 to-white px-6 py-10">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          {result.passed ? (
            <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
          ) : (
            <XCircle className="mx-auto text-red-500" size={40} />
          )}
          <p className="mt-4 text-3xl font-bold text-slate-900">{result.score}%</p>
          <p className="mt-1 text-sm text-slate-500">
            {result.correctCount} of {result.total} correct — {result.passed ? "Passed" : "Not passed"}
          </p>

          {reviewLoading ? (
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="animate-spin" size={14} /> Preparing feedback…
            </p>
          ) : reviewSummary ? (
            <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm leading-6 text-slate-700">
              {reviewSummary}
            </p>
          ) : null}

          {result.certificateId ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <Award className="mx-auto text-amber-600" size={24} />
              <p className="mt-2 text-sm font-semibold text-amber-900">Certificate earned</p>
              <p className="mt-1 text-xs text-amber-700">{result.certificateId}</p>
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-3 rounded-full border border-amber-300 px-4 py-1.5 text-xs font-semibold text-amber-800"
              >
                Print certificate
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onExit}
            className="mt-8 rounded-full bg-[#10283f] px-6 py-3 text-sm font-semibold text-white"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return null;
}
