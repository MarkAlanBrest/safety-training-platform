"use client";

import { BuilderCheckboxGrid, BuilderField, BuilderInput } from "@/components/classroom/builder/BuilderSection";
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type ClassroomFinalTestConfig,
} from "@/lib/classroom-question-types";

const TYPE_OPTIONS = QUESTION_TYPES.map((id) => ({ id, label: QUESTION_TYPE_LABELS[id] }));

export default function FinalTestConfigSection({
  config,
  questionCount,
  onChange,
}: {
  config: ClassroomFinalTestConfig;
  questionCount: number;
  onChange: (config: ClassroomFinalTestConfig) => void;
}) {
  return (
    <div className="space-y-5">
      <label className="flex items-center gap-3 rounded-2xl border border-[#10283f]/10 bg-[#faf8f3] px-4 py-3">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
          className="accent-[#c68b1b]"
        />
        <span className="text-sm font-semibold text-[#10283f]">
          Enable Final Test ({questionCount} question{questionCount === 1 ? "" : "s"} accepted into the bank)
        </span>
      </label>

      {config.enabled ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <BuilderField label="Number of questions per attempt">
              <BuilderInput
                type="number"
                min={1}
                max={200}
                value={config.questionCount}
                onChange={(event) =>
                  onChange({ ...config, questionCount: Math.max(1, Number(event.target.value) || 1) })
                }
              />
            </BuilderField>
            <BuilderField label="Passing score (%)">
              <BuilderInput
                type="number"
                min={0}
                max={100}
                value={config.passingScore}
                onChange={(event) =>
                  onChange({
                    ...config,
                    passingScore: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                  })
                }
              />
            </BuilderField>
            <BuilderField label="Attempts allowed" hint="0 = unlimited">
              <BuilderInput
                type="number"
                min={0}
                max={20}
                value={config.attemptsAllowed}
                onChange={(event) =>
                  onChange({ ...config, attemptsAllowed: Math.max(0, Number(event.target.value) || 0) })
                }
              />
            </BuilderField>
            <BuilderField label="Time limit (minutes)" hint="Leave blank for untimed">
              <BuilderInput
                type="number"
                min={1}
                max={480}
                value={config.timeLimitMinutes ?? ""}
                onChange={(event) =>
                  onChange({
                    ...config,
                    timeLimitMinutes: event.target.value ? Math.max(1, Number(event.target.value)) : null,
                  })
                }
              />
            </BuilderField>
          </div>

          <BuilderField label="Question types included">
            <BuilderCheckboxGrid
              options={TYPE_OPTIONS}
              values={Object.fromEntries(TYPE_OPTIONS.map((option) => [option.id, config.includedTypes.includes(option.id)]))}
              onChange={(id, checked) =>
                onChange({
                  ...config,
                  includedTypes: checked
                    ? [...config.includedTypes, id as (typeof QUESTION_TYPES)[number]]
                    : config.includedTypes.filter((type) => type !== id),
                })
              }
            />
          </BuilderField>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border border-[#10283f]/10 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={config.randomizeQuestions}
                onChange={(event) => onChange({ ...config, randomizeQuestions: event.target.checked })}
                className="accent-[#c68b1b]"
              />
              Randomize question order
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-[#10283f]/10 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={config.randomizeChoiceOrder}
                onChange={(event) => onChange({ ...config, randomizeChoiceOrder: event.target.checked })}
                className="accent-[#c68b1b]"
              />
              Randomize answer order
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-[#10283f]/10 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={config.certificateOnPass}
                onChange={(event) => onChange({ ...config, certificateOnPass: event.target.checked })}
                className="accent-[#c68b1b]"
              />
              Issue certificate on pass
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-[#10283f]/10 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={config.aiReviewAfterSubmission}
                onChange={(event) => onChange({ ...config, aiReviewAfterSubmission: event.target.checked })}
                className="accent-[#c68b1b]"
              />
              AI review after submission
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}
