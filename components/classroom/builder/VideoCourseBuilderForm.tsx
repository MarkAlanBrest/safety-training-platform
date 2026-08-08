"use client";

import { useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  completeClassroomAssetUpload,
  uploadClassroomAsset,
} from "@/lib/classroom-asset-upload-client";
import { transcribeVideoFile, vttToFile } from "@/lib/client-transcribe-video";
import { createVideoId } from "@/lib/classroom-video";

export default function VideoCourseBuilderForm() {
  const previewRef = useRef<HTMLVideoElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [captionsFile, setCaptionsFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [transcriptStatus, setTranscriptStatus] = useState("");
  const [transcriptError, setTranscriptError] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [manualCaptions, setManualCaptions] = useState(false);
  const [error, setError] = useState("");
  const [successUrl, setSuccessUrl] = useState("");

  const videoId = useMemo(() => createVideoId("video"), []);
  const transcribeTokenRef = useRef(0);

  function handleVideoSelect(file: File | null) {
    transcribeTokenRef.current += 1;
    setTranscribing(false);
    setVideoFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
    setCaptionsFile(null);
    setManualCaptions(false);
    setTranscriptStatus("");
    setTranscriptError("");
  }

  async function ensureTranscript(): Promise<File | null> {
    if (manualCaptions) return captionsFile;
    if (captionsFile) return captionsFile;
    if (!videoFile) return null;

    const token = ++transcribeTokenRef.current;
    setTranscribing(true);
    setTranscriptStatus("Generating transcript from video…");
    setTranscriptError("");

    try {
      const vtt = await transcribeVideoFile(videoFile, (message) => {
        if (token === transcribeTokenRef.current) setTranscriptStatus(message);
      });
      if (token !== transcribeTokenRef.current) return null;
      const file = vttToFile(vtt, videoId);
      setCaptionsFile(file);
      setTranscriptStatus("Transcript ready.");
      return file;
    } catch (reason) {
      if (token !== transcribeTokenRef.current) return null;
      const message =
        reason instanceof Error ? reason.message : "The video could not be transcribed.";
      setTranscriptStatus("");
      setTranscriptError(message);
      throw new Error(message);
    } finally {
      if (token === transcribeTokenRef.current) setTranscribing(false);
    }
  }

  async function handleSubmit(published: boolean) {
    if (!title.trim() || !videoFile) {
      setError("Add a course title and video file.");
      return;
    }
    if (transcribing || saving) {
      return;
    }

    setSaving(true);
    setError("");
    setUploadProgress("");
    setTranscriptError("");

    try {
      let scriptFile = captionsFile;
      if (published && !scriptFile && !manualCaptions) {
        scriptFile = await ensureTranscript();
      }

      const durationSeconds = previewRef.current?.duration || undefined;
      const createResponse = await fetch("/api/classroom/video-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          published,
          videoAssetPath: `classroom/media/${videoId}`,
          captionsAssetPath: scriptFile
            ? `classroom/media/${videoId}.vtt`
            : undefined,
          durationSeconds,
          chapters: [],
          markers: [],
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
      if (scriptFile) {
        setUploadProgress("Uploading transcript…");
        await uploadClassroomAsset(
          created.course.slug,
          `classroom/media/${videoId}.vtt`,
          scriptFile,
          "text/vtt",
        );
      }
      setUploadProgress("Finishing…");
      await completeClassroomAssetUpload(created.course.slug, published);
      setUploadProgress("");
      setSuccessUrl(`/admin/courses/${created.course.slug}/activities`);
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
          Export your presentation from PowerPoint as MP4 and upload it here. Publishing uploads
          the video and builds the timed chat script. You&apos;ll add AI stop points on the next
          screen.
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
                handleVideoSelect(event.target.files?.[0] || null);
              }}
            />
          </label>
          <label className="block text-sm font-semibold text-[#10283f]">
            Timed script (.vtt) — optional
            <input
              type="file"
              accept=".vtt,text/vtt"
              className="mt-2 block w-full text-sm"
              disabled={transcribing}
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                transcribeTokenRef.current += 1;
                setTranscribing(false);
                setManualCaptions(Boolean(file));
                setCaptionsFile(file);
                setTranscriptError("");
                if (file) {
                  setTranscriptStatus("Using your uploaded script file.");
                } else {
                  setTranscriptStatus("");
                }
              }}
            />
          </label>
        </div>
        {captionsFile ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            Script file ready ({captionsFile.name})
          </p>
        ) : null}
        {transcribing || transcriptStatus ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
            {transcribing || saving ? <LoaderCircle className="animate-spin" size={16} /> : null}
            {transcriptStatus}
          </p>
        ) : null}
        {transcriptError ? (
          <p className="mt-3 text-sm font-semibold text-red-600">{transcriptError}</p>
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

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {uploadProgress ? (
        <p className="text-sm font-semibold text-slate-600">{uploadProgress}</p>
      ) : null}
      {successUrl ? (
        <p className="text-sm font-semibold text-emerald-700">
          Video uploaded.{" "}
          <a href={successUrl} className="underline">
            Continue to activities
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
          {saving || transcribing ? <LoaderCircle className="animate-spin" size={16} /> : null}
          {transcribing ? "Generating transcript…" : saving ? "Publishing video…" : "Publish video"}
        </button>
      </div>
    </div>
  );
}
