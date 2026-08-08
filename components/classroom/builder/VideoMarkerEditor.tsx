"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  createVideoId,
  formatTimestamp,
  parseTimestampInput,
  type VideoMarkerKind,
  type VideoTimelineMarker,
} from "@/lib/classroom-video";

const MARKER_KINDS: Array<{ id: VideoMarkerKind; label: string }> = [
  { id: "continue", label: "Auto-continue" },
  { id: "ai_say", label: "AI says something" },
  { id: "ask_question", label: "Ask a question (open)" },
  { id: "quick_check", label: "Quick check (graded)" },
];

function emptyMarker(): VideoTimelineMarker {
  return {
    id: createVideoId("marker"),
    atSeconds: 0,
    kind: "continue",
    label: "",
  };
}

type VideoMarkerEditorProps = {
  markers: VideoTimelineMarker[];
  onChange: (markers: VideoTimelineMarker[]) => void;
  markerTime: string;
  onMarkerTimeChange: (value: string) => void;
  onCapturePreviewTime?: () => void;
  disabled?: boolean;
};

export default function VideoMarkerEditor({
  markers,
  onChange,
  markerTime,
  onMarkerTimeChange,
  onCapturePreviewTime,
  disabled = false,
}: VideoMarkerEditorProps) {
  function addMarker() {
    const atSeconds = parseTimestampInput(markerTime);
    if (atSeconds === null) return;
    onChange([...markers, { ...emptyMarker(), atSeconds }]);
  }

  function updateMarker(id: string, patch: Partial<VideoTimelineMarker>) {
    onChange(markers.map((marker) => (marker.id === id ? { ...marker, ...patch } : marker)));
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-[#10283f]">
          Time
          <input
            value={markerTime}
            onChange={(event) => onMarkerTimeChange(event.target.value)}
            disabled={disabled}
            className="mt-2 block w-28 rounded-xl border border-[#10283f]/15 px-3 py-2 disabled:opacity-50"
            placeholder="5:15"
          />
        </label>
        {onCapturePreviewTime ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onCapturePreviewTime}
            className="rounded-xl border border-[#10283f]/15 px-3 py-2 text-sm font-bold text-[#10283f] disabled:opacity-50"
          >
            Use preview time
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={addMarker}
          className="inline-flex items-center gap-2 rounded-xl bg-[#10283f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          <Plus size={16} /> Add stop point
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {markers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No stop points yet. Generate from the transcript or add them manually.
          </p>
        ) : null}
        {markers.map((marker) => (
          <div key={marker.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                {formatTimestamp(marker.atSeconds)}
              </span>
              <select
                value={marker.kind}
                disabled={disabled}
                onChange={(event) =>
                  updateMarker(marker.id, { kind: event.target.value as VideoMarkerKind })
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
              >
                {MARKER_KINDS.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(markers.filter((item) => item.id !== marker.id))}
                className="ml-auto text-slate-400 hover:text-red-600 disabled:opacity-50"
                aria-label="Remove stop point"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {marker.kind === "ai_say" ? (
              <textarea
                value={marker.aiScript || ""}
                disabled={disabled}
                onChange={(event) => updateMarker(marker.id, { aiScript: event.target.value })}
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                placeholder="What should the AI say before continuing?"
                rows={3}
              />
            ) : null}

            {marker.kind === "ask_question" || marker.kind === "quick_check" ? (
              <div className="mt-3 space-y-3">
                <input
                  value={marker.aiScript || ""}
                  disabled={disabled}
                  onChange={(event) => updateMarker(marker.id, { aiScript: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                  placeholder="Short AI lead-in (optional)"
                />
                <input
                  value={marker.questionPrompt || ""}
                  disabled={disabled}
                  onChange={(event) =>
                    updateMarker(marker.id, { questionPrompt: event.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                  placeholder="Question"
                />
                <select
                  value={marker.questionType || "shortAnswer"}
                  disabled={disabled}
                  onChange={(event) =>
                    updateMarker(marker.id, {
                      questionType: event.target.value as VideoTimelineMarker["questionType"],
                    })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="shortAnswer">Short answer</option>
                  <option value="multipleChoice">Multiple choice</option>
                  <option value="trueFalse">True / false</option>
                </select>
                {marker.questionType === "multipleChoice" ? (
                  <textarea
                    value={(marker.options || []).join("\n")}
                    disabled={disabled}
                    onChange={(event) =>
                      updateMarker(marker.id, {
                        options: event.target.value.split("\n").map((line) => line.trim()),
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                    placeholder="One answer option per line"
                    rows={4}
                  />
                ) : null}
                <input
                  value={marker.correctAnswer || ""}
                  disabled={disabled}
                  onChange={(event) =>
                    updateMarker(marker.id, { correctAnswer: event.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                  placeholder="Answer key"
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
