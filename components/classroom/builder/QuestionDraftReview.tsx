"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { BuilderField, BuilderInput, BuilderTextarea } from "@/components/classroom/builder/BuilderSection";
import {
  QUESTION_TYPE_LABELS,
  type ClassroomQuestion,
  type GeneratedFormative,
} from "@/lib/classroom-question-types";

function updateChoice(choices: string[], index: number, value: string) {
  const next = [...choices];
  next[index] = value;
  return next;
}

/** Editable fields for one question, shared by both formative and final-test-bank drafts. */
export function QuestionEditorFields({
  question,
  onChange,
}: {
  question: ClassroomQuestion;
  onChange: (next: ClassroomQuestion) => void;
}) {
  return (
    <div className="space-y-3">
      <BuilderField label="Prompt">
        <BuilderTextarea
          rows={2}
          value={question.type === "scenario" ? question.scenarioText : question.prompt}
          onChange={(event) =>
            question.type === "scenario"
              ? onChange({ ...question, scenarioText: event.target.value })
              : onChange({ ...question, prompt: event.target.value })
          }
        />
      </BuilderField>

      {question.type === "multipleChoice" ? (
        <div className="space-y-2">
          {question.choices.map((choice, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="radio"
                checked={question.correctChoice === choice && Boolean(choice.trim())}
                onChange={() => onChange({ ...question, correctChoice: choice })}
                disabled={!choice.trim()}
                title="Correct answer"
              />
              <BuilderInput
                value={choice}
                onChange={(event) => {
                  const choices = updateChoice(question.choices, index, event.target.value);
                  const correctChoice =
                    question.correctChoice === choice ? event.target.value : question.correctChoice;
                  onChange({ ...question, choices, correctChoice });
                }}
                placeholder={`Choice ${index + 1}`}
              />
            </div>
          ))}
        </div>
      ) : null}

      {question.type === "trueFalse" ? (
        <div className="flex gap-2">
          {[true, false].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => onChange({ ...question, correctAnswer: value })}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                question.correctAnswer === value
                  ? "bg-[#10283f] text-white"
                  : "border border-[#10283f]/15 text-[#10283f]"
              }`}
            >
              {value ? "True" : "False"}
            </button>
          ))}
        </div>
      ) : null}

      {question.type === "dragDrop" ? (
        <div className="space-y-2">
          {question.dragItems.map((item, index) => (
            <BuilderInput
              key={index}
              value={item}
              onChange={(event) => {
                const dragItems = [...question.dragItems];
                dragItems[index] = event.target.value;
                onChange({ ...question, dragItems });
              }}
              placeholder={`Step ${index + 1} (correct order)`}
            />
          ))}
        </div>
      ) : null}

      {question.type === "flashcard" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <BuilderField label="Front">
            <BuilderInput
              value={question.front}
              onChange={(event) => onChange({ ...question, front: event.target.value })}
            />
          </BuilderField>
          <BuilderField label="Back">
            <BuilderInput
              value={question.back}
              onChange={(event) => onChange({ ...question, back: event.target.value })}
            />
          </BuilderField>
        </div>
      ) : null}

      {question.type === "hotspot" ? (
        <p className="rounded-xl bg-[#faf8f3] px-3 py-2 text-xs text-[#69757e]">
          AI-detected click target on the slide image
          {question.explanation ? `: ${question.explanation}` : "."} Tolerance{" "}
          {question.toleranceRadius}% of the image.
        </p>
      ) : null}

      {question.type === "shortAnswer" ? (
        <BuilderField label="Sample answer" hint="Used as a rubric reference, shown to the instructor only.">
          <BuilderTextarea
            rows={2}
            value={question.sampleAnswer}
            onChange={(event) => onChange({ ...question, sampleAnswer: event.target.value })}
          />
        </BuilderField>
      ) : null}

      {question.type === "scenario" ? (
        <div className="space-y-3">
          <BuilderField label="Question for the learner">
            <BuilderInput
              value={question.prompt}
              onChange={(event) => onChange({ ...question, prompt: event.target.value })}
            />
          </BuilderField>
          {question.responseMode === "multipleChoice" ? (
            <div className="space-y-2">
              {question.choices.map((choice, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={question.correctChoice === choice && Boolean(choice.trim())}
                    onChange={() => onChange({ ...question, correctChoice: choice })}
                    disabled={!choice.trim()}
                    title="Correct answer"
                  />
                  <BuilderInput
                    value={choice}
                    onChange={(event) => {
                      const choices = updateChoice(question.choices, index, event.target.value);
                      onChange({ ...question, choices });
                    }}
                    placeholder={`Choice ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <BuilderField label="Sample answer">
              <BuilderTextarea
                rows={2}
                value={question.sampleAnswer}
                onChange={(event) => onChange({ ...question, sampleAnswer: event.target.value })}
              />
            </BuilderField>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DraftCard({
  typeLabel,
  question,
  onChange,
  onAccept,
  onDelete,
}: {
  typeLabel: string;
  question: ClassroomQuestion;
  onChange: (next: ClassroomQuestion) => void;
  onAccept: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#10283f]/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a06e16]">{typeLabel}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
          >
            <Check size={14} />
            Accept
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-200 p-2 text-red-600"
            aria-label="Delete draft"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <QuestionEditorFields question={question} onChange={onChange} />
    </div>
  );
}

export default function QuestionDraftReview({
  formatives,
  bankQuestions,
  warnings,
  onAcceptFormative,
  onAcceptBankQuestion,
}: {
  formatives: GeneratedFormative[];
  bankQuestions: ClassroomQuestion[];
  warnings: string[];
  onAcceptFormative: (item: GeneratedFormative) => void;
  onAcceptBankQuestion: (question: ClassroomQuestion) => void;
}) {
  const [pendingFormatives, setPendingFormatives] = useState(formatives);
  const [pendingBank, setPendingBank] = useState(bankQuestions);

  function updateFormative(index: number, question: ClassroomQuestion) {
    setPendingFormatives((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, question } : item)),
    );
  }

  function acceptFormative(index: number) {
    const item = pendingFormatives[index];
    onAcceptFormative(item);
    setPendingFormatives((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function deleteFormative(index: number) {
    setPendingFormatives((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateBank(index: number, question: ClassroomQuestion) {
    setPendingBank((current) => current.map((item, itemIndex) => (itemIndex === index ? question : item)));
  }

  function acceptBank(index: number) {
    onAcceptBankQuestion(pendingBank[index]);
    setPendingBank((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function deleteBank(index: number) {
    setPendingBank((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  if (!pendingFormatives.length && !pendingBank.length && !warnings.length) return null;

  return (
    <div className="space-y-5">
      {warnings.map((warning, index) => (
        <p key={index} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warning}
        </p>
      ))}

      {pendingFormatives.length ? (
        <div className="space-y-3">
          <p className="text-sm font-bold text-[#10283f]">
            In-lesson checks ({pendingFormatives.length} to review)
          </p>
          {pendingFormatives.map((item, index) => (
            <DraftCard
              key={item.question.id}
              typeLabel={`${QUESTION_TYPE_LABELS[item.question.type]} · after slide ${item.slideIndex + 1}`}
              question={item.question}
              onChange={(question) => updateFormative(index, question)}
              onAccept={() => acceptFormative(index)}
              onDelete={() => deleteFormative(index)}
            />
          ))}
        </div>
      ) : null}

      {pendingBank.length ? (
        <div className="space-y-3">
          <p className="text-sm font-bold text-[#10283f]">
            Final test question bank ({pendingBank.length} to review)
          </p>
          {pendingBank.map((question, index) => (
            <DraftCard
              key={question.id}
              typeLabel={QUESTION_TYPE_LABELS[question.type]}
              question={question}
              onChange={(next) => updateBank(index, next)}
              onAccept={() => acceptBank(index)}
              onDelete={() => deleteBank(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
