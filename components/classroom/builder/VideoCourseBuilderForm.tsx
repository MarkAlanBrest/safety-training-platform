"use client";

import { useMemo, useRef, useState } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import {
  completeClassroomAssetUpload,
  uploadClassroomAsset,
} from "@/lib/classroom-asset-upload-client";
import { transcribeVideoFile, vttToFile } from "@/lib/client-transcribe-video";
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

export default function VideoCourseBuilderForm() {
  const previewRef = useRef<HTMLVideoElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [captionsFile, setCaptionsFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [markers, setMarkers] = useState<VideoTimelineMarker[]>([]);
  const [markerTime, setMarkerTime] = useState("0:00");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [transcriptStatus, setTranscriptStatus] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [manualCaptions, setManualCaptions] = useState(false);
  const [error, setError] = useState("");
  const [successUrl, setSuccessUrl] = useState("");

  const videoId = useMemo(() => createVideoId("video"), []);
  const transcribeTokenRef = useRef(0);

  async function handleVideoSelect(file: File | null) {
    setVideoFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");

    if (!file) {
      setCaptionsFile(null);
      setManualCaptions(false);
      setTranscriptStatus("");
      return;
    }

    if (manualCaptions) return;

    const token = ++transcribeTokenRef.current;
    setTranscribing(true);
    setTranscriptStatus("Reading video audio…");
    setCaptionsFile(null);
    setError("");

    try {
      const vtt = await transcribeVideoFile(file, (message) => {
        if (token === transcribeTokenRef.current) setTranscriptStatus(message);
      });
      if (token !== transcribeTokenRef.current) return;
      setCaptionsFile(vttToFile(vtt, videoId));
      setTranscriptStatus("Transcript ready — it will appear in the chat during playback.");
    } catch (reason) {
      if (token !== transcribeTokenRef.current) return;
      const message =
        reason instanceof Error ? reason.message : "The video could not be transcribed.";
      setTranscriptStatus("");
      setError(
        `${message} You can still publish the course and upload a .vtt script file instead.`,
      );
    } finally {
      if (token === transcribeTokenRef.current) setTranscribing(false);
    }
  }

  function capturePreviewTime() {
    const seconds = previewRef.current?.currentTime ?? 0;
    setMarkerTime(formatTimestamp(seconds));
  }

  function addMarker() {
    const atSeconds = parseTimestampInput(markerTime);
    if (atSeconds === null) {
      setError("Enter a valid marker time.");
      return;
    }
    setMarkers((current) => [...current, { ...emptyMarker(), atSeconds }]);
    setError("");
  }

  function updateMarker(id: string, patch: Partial<VideoTimelineMarker>) {
    setMarkers((current) =>
      current.map((marker) => (marker.id === id ? { ...marker, ...patch } : marker)),
    );
  }

  async function handleSubmit(published: boolean) {
    if (!title.trim() || !videoFile) {
      setError("Add a course title and video file.");
      return;
    }
    if (transcribing) {
      setError("Wait for the transcript to finish generating.");
      return;
    }

    setSaving(true);
    setError("");
    setUploadProgress("");
    try {
      const durationSeconds = previewRef.current?.duration || undefined;
      const createResponse = await fetch("/api/classroom/video-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          published,
          videoAssetPath: `classroom/media/${videoId}`,
          captionsAssetPath: captionsFile
            ? `classroom/media/${videoId}.vtt`
            : undefined,
          durationSeconds,
          chapters: [],
          markers,
        }),
      });
      const created = await createResponse.json();
      if (!createResponse.ok) throw new Error(created.error || "Course could not be created.");

      await uploadClassroomAsset(
        created.course.slug,
        `classroom/media/${videoId}`,
        videoFile,
        videoFile.type || "video/mp4",
        (uploaded, total) => setUploadProgress(`Uploading video… ${uploaded}/${total} parts`),
      );
      if (captionsFile) {
        setUploadProgress("Uploading captions…");
        await uploadClassroomAsset(
          created.course.slug,
          `classroom/media/${videoId}.vtt`,
          captionsFile,
          "text/vtt",
        );
      }
      setUploadProgress("Finishing…");
      await completeClassroomAssetUpload(created.course.slug, published);
      setUploadProgress("");
      setSuccessUrl(created.previewUrl);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Course could not be saved.";
      setError(
        message === "Failed to fetch"
          ? "Upload interrupted — check your connection. Try a smaller video (under 200 MB) or compress to 1080p."
          : message,
      );
      setUploadProgress("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#10283f]">Course details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-[#10283f]">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
              placeholder="Fall Protection Basics"
            />
          </label>
          <label className="block text-sm font-semibold text-[#10283f]">
            Description
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
              placeholder="Optional short description"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#10283f]">Video</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Export your presentation from PowerPoint as MP4. When you upload the video, the platform
          reads the audio and builds a timed transcript for the instructor chat automatically.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-[#10283f]">
            Course video (.mp4 / .webm)
            <input
              type="file"
              accept="video/mp4,video/webm"
              className="mt-2 block w-full text-sm"
              disabled={transcribing}
              onChange={(event) => {
                void handleVideoSelect(event.target.files?.[0] || null);
              }}
            />
          </label>
          <label className="block text-sm font-semibold text-[#10283f]">
            Timed script (.vtt) — optional override
            <input
              type="file"
              accept=".vtt,text/vtt"
              className="mt-2 block w-full text-sm"
              disabled={transcribing}
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setManualCaptions(Boolean(file));
                setCaptionsFile(file);
                if (file) {
                  transcribeTokenRef.current += 1;
                  setTranscribing(false);
                  setTranscriptStatus("Using your uploaded script file.");
                } else {
                  setTranscriptStatus("");
                  if (videoFile) void handleVideoSelect(videoFile);
                }
              }}
            />
          </label>
        </div>
        {transcribing || transcriptStatus ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
            {transcribing ? <LoaderCircle className="animate-spin" size={16} /> : null}
            {transcriptStatus}
          </p>
        ) : null}
        {previewUrl ? (
          <video
            ref={previewRef}
            src={previewUrl}
            controls
            className="mt-4 aspect-video w-full rounded-2xl bg-black"
          />
        ) : null}
      </section>

      <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#10283f]">AI stop points</h2>
        <p className="mt-2 text-sm text-slate-600">
          Pause the video and choose what the AI should do at each moment.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-[#10283f]">
            Time
            <input
              value={markerTime}
              onChange={(event) => setMarkerTime(event.target.value)}
              className="mt-2 block w-28 rounded-xl border border-[#10283f]/15 px-3 py-2"
              placeholder="5:15"
            />
          </label>
          <button
            type="button"
            onClick={capturePreviewTime}
            className="rounded-xl border border-[#10283f]/15 px-3 py-2 text-sm font-bold text-[#10283f]"
          >
            Use preview time
          </button>
          <button
            type="button"
            onClick={addMarker}
            className="inline-flex items-center gap-2 rounded-xl bg-[#10283f] px-4 py-2.5 text-sm font-bold text-white"
          >
            <Plus size={16} /> Add stop point
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {markers.map((marker) => (
            <div key={marker.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                  {formatTimestamp(marker.atSeconds)}
                </span>
                <select
                  value={marker.kind}
                  onChange={(event) =>
                    updateMarker(marker.id, { kind: event.target.value as VideoMarkerKind })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {MARKER_KINDS.map((kind) => (
                    <option key={kind.id} value={kind.id}>
                      {kind.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setMarkers((current) => current.filter((item) => item.id !== marker.id))
                  }
                  className="ml-auto text-slate-400 hover:text-red-600"
                  aria-label="Remove stop point"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {marker.kind === "ai_say" ? (
                <textarea
                  value={marker.aiScript || ""}
                  onChange={(event) => updateMarker(marker.id, { aiScript: event.target.value })}
                  className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="What should the AI say before continuing?"
                  rows={3}
                />
              ) : null}

              {marker.kind === "ask_question" || marker.kind === "quick_check" ? (
                <div className="mt-3 space-y-3">
                  <input
                    value={marker.aiScript || ""}
                    onChange={(event) => updateMarker(marker.id, { aiScript: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Short AI lead-in (optional)"
                  />
                  <input
                    value={marker.questionPrompt || ""}
                    onChange={(event) =>
                      updateMarker(marker.id, { questionPrompt: event.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Question"
                  />
                  <select
                    value={marker.questionType || "shortAnswer"}
                    onChange={(event) =>
                      updateMarker(marker.id, {
                        questionType: event.target.value as VideoTimelineMarker["questionType"],
                      })
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="shortAnswer">Short answer</option>
                    <option value="multipleChoice">Multiple choice</option>
                    <option value="trueFalse">True / false</option>
                  </select>
                  {marker.questionType === "multipleChoice" ? (
                    <textarea
                      value={(marker.options || []).join("\n")}
                      onChange={(event) =>
                        updateMarker(marker.id, {
                          options: event.target.value.split("\n").map((line) => line.trim()),
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="One answer option per line"
                      rows={4}
                    />
                  ) : null}
                  <input
                    value={marker.correctAnswer || ""}
                    onChange={(event) =>
                      updateMarker(marker.id, { correctAnswer: event.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Answer key"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {uploadProgress ? (
        <p className="text-sm font-semibold text-slate-600">{uploadProgress}</p>
      ) : null}
      {successUrl ? (
        <p className="text-sm font-semibold text-emerald-700">
          Course saved.{" "}
          <a href={successUrl} className="underline">
            Open classroom preview
          </a>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving || transcribing}
          onClick={() => void handleSubmit(false)}
          className="rounded-xl border border-[#10283f]/15 px-5 py-3 text-sm font-bold text-[#10283f] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          disabled={saving || transcribing}
          onClick={() => void handleSubmit(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#c68b1b] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="animate-spin" size={16} /> : null}
          Publish course
        </button>
      </div>
    </div>
  );
}
