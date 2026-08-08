"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import VideoMarkerEditor from "@/components/classroom/builder/VideoMarkerEditor";
import { parseJsonResponse } from "@/lib/parse-response";
import { formatTimestamp, type VideoTimelineMarker } from "@/lib/classroom-video";

type ActivitiesPayload = {
  title: string;
  slug: string;
  published: boolean;
  videoCourse: {
    videoUrl?: string;
    captionsUrl?: string;
    markers: VideoTimelineMarker[];
    publishedMarkers: VideoTimelineMarker[];
    activitiesPublished: boolean;
    durationSeconds?: number;
  };
  error?: string;
};

export default function VideoActivitiesPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const previewRef = useRef<HTMLVideoElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState("");
  const [coursePublished, setCoursePublished] = useState(false);
  const [activitiesPublished, setActivitiesPublished] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const [markers, setMarkers] = useState<VideoTimelineMarker[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [captionsUrl, setCaptionsUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>();
  const [markerTime, setMarkerTime] = useState("1:00");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(slug)}/video-activities`);
      const data = await parseJsonResponse<ActivitiesPayload>(response);
      if (!response.ok) throw new Error(data.error || "Activities could not be loaded.");

      setTitle(data.title);
      setCoursePublished(data.published);
      setActivitiesPublished(data.videoCourse.activitiesPublished);
      setPublishedCount(data.videoCourse.publishedMarkers.length);
      setMarkers(data.videoCourse.markers);
      setVideoUrl(data.videoCourse.videoUrl || "");
      setCaptionsUrl(data.videoCourse.captionsUrl || "");
      setDurationSeconds(data.videoCourse.durationSeconds);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Activities could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  async function saveDraft() {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(slug)}/video-activities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-draft", markers }),
      });
      const data = await parseJsonResponse<{
        videoCourse?: { markers: VideoTimelineMarker[] };
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error || "Draft could not be saved.");
      setMarkers(data.videoCourse?.markers || markers);
      setStatus("Draft saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Draft could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function publishActivities() {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(slug)}/video-activities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", markers }),
      });
      const data = await parseJsonResponse<{
        videoCourse?: {
          markers: VideoTimelineMarker[];
          publishedMarkers: VideoTimelineMarker[];
          activitiesPublished: boolean;
        };
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error || "Activities could not be published.");

      setMarkers(data.videoCourse?.markers || markers);
      setPublishedCount(data.videoCourse?.publishedMarkers.length || 0);
      setActivitiesPublished(Boolean(data.videoCourse?.activitiesPublished));
      setStatus(`Published ${data.videoCourse?.publishedMarkers.length || markers.length} stop points for learners.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Activities could not be published.");
    } finally {
      setSaving(false);
    }
  }

  async function unpublishActivities() {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(slug)}/video-activities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish", markers }),
      });
      const data = await parseJsonResponse<{
        videoCourse?: { activitiesPublished: boolean };
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error || "Activities could not be unpublished.");
      setActivitiesPublished(Boolean(data.videoCourse?.activitiesPublished));
      setStatus("Activities are now hidden from learners.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Activities could not be unpublished.");
    } finally {
      setSaving(false);
    }
  }

  async function generateFromTranscript() {
    if (!captionsUrl) {
      setError("This course does not have a transcript yet.");
      return;
    }

    setGenerating(true);
    setError("");
    setStatus("Generating stop points from transcript…");
    try {
      const transcriptResponse = await fetch(captionsUrl);
      if (!transcriptResponse.ok) {
        throw new Error("The transcript file could not be loaded.");
      }
      const vtt = await transcriptResponse.text();
      const response = await fetch("/api/classroom/generate-video-markers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: title,
          vtt,
          durationSeconds: durationSeconds || previewRef.current?.duration,
        }),
      });
      const result = await parseJsonResponse<{
        markers?: VideoTimelineMarker[];
        warnings?: string[];
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(result.error || "Stop points could not be generated.");

      const generated = result.markers || [];
      setMarkers(generated);
      setStatus(
        generated.length
          ? `Generated ${generated.length} draft stop points. Review them, then publish activities.`
          : "No stop points were generated for this video length.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Stop points could not be generated.");
      setStatus("");
    } finally {
      setGenerating(false);
    }
  }

  function capturePreviewTime() {
    const seconds = previewRef.current?.currentTime ?? 0;
    setMarkerTime(formatTimestamp(seconds));
  }

  const busy = loading || saving || generating;

  return (
    <AdminShell title={title || "Course activities"} eyebrow="Video activities">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-[#10283f]/10 bg-[#10283f] px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8c273]">Step 2 — Activities</p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/80">
            The video is already uploaded. Build AI stop points here, save drafts as you go, then
            publish activities when learners should see them. Course enrollment is controlled
            separately in course settings.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            <span
              className={`rounded-full px-3 py-1 ${
                activitiesPublished ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-white/80"
              }`}
            >
              {activitiesPublished
                ? `${publishedCount} activities live for learners`
                : "Activities not published yet"}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">
              Course {coursePublished ? "published" : "draft"}
            </span>
          </div>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <LoaderCircle className="animate-spin" size={16} /> Loading activities…
          </p>
        ) : null}

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        {status ? <p className="text-sm font-semibold text-emerald-700">{status}</p> : null}

        {!loading ? (
          <>
            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#10283f]">Video preview</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Scrub to a moment, then add or edit stop points below.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !captionsUrl}
                  onClick={() => void generateFromTranscript()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#10283f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {generating ? <LoaderCircle className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  {generating ? "Generating…" : "Generate from transcript"}
                </button>
              </div>
              {videoUrl ? (
                <video
                  ref={previewRef}
                  src={videoUrl}
                  controls
                  className="mt-4 aspect-video w-full rounded-2xl bg-black"
                />
              ) : null}
            </section>

            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-[#10283f]">AI stop points</h2>
              <p className="mt-2 text-sm text-slate-600">
                These pause the video for recap moments and quick checks. Learners only see them
                after you publish activities.
              </p>
              <div className="mt-4">
                <VideoMarkerEditor
                  markers={markers}
                  onChange={setMarkers}
                  markerTime={markerTime}
                  onMarkerTimeChange={setMarkerTime}
                  onCapturePreviewTime={capturePreviewTime}
                  disabled={busy}
                />
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveDraft()}
                className="rounded-xl border border-[#10283f]/15 px-5 py-3 text-sm font-bold text-[#10283f] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                disabled={busy || !markers.length}
                onClick={() => void publishActivities()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#c68b1b] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? <LoaderCircle className="animate-spin" size={16} /> : null}
                Publish activities
              </button>
              {activitiesPublished ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void unpublishActivities()}
                  className="rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-700 disabled:opacity-50"
                >
                  Unpublish activities
                </button>
              ) : null}
              <Link
                href={`/admin/courses/${slug}`}
                className="rounded-xl border border-[#10283f]/15 px-5 py-3 text-sm font-bold text-[#10283f]"
              >
                Back to course
              </Link>
              <Link
                href={`/classroom/${slug}?preview=1`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-[#10283f]/15 px-5 py-3 text-sm font-bold text-[#10283f]"
              >
                Preview draft activities
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
