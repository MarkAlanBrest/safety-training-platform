"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import YouTubePlayer, { type YouTubePlayerHandle } from "@/components/video/YouTubePlayer";
import VideoCourseTopBar from "@/components/video/VideoCourseTopBar";
import VideoCuePanel from "@/components/video/VideoCuePanel";
import {
  formatTimestamp,
  videoCourseCompleted,
  videoProgressPercent,
  type VideoCue,
  type VideoPlan,
  type VideoProgressData,
} from "@/lib/video";

export type PublicVideoCourse = {
  title: string;
  slug: string;
  description: string | null;
  plan: VideoPlan;
};

export default function VideoCourseShell({
  course,
  preview = false,
}: {
  course: PublicVideoCourse;
  preview?: boolean;
}) {
  const searchParams = useSearchParams();
  const code = searchParams?.get("code") || "";
  const plan = course.plan;

  const playerRef = useRef<YouTubePlayerHandle | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(plan.source.durationSeconds || 0);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [progress, setProgress] = useState<VideoProgressData>({
    currentSeconds: 0,
    maxWatchedSeconds: 0,
    completedCueIds: [],
  });
  const [activeCue, setActiveCue] = useState<VideoCue | null>(null);
  const [certificateUrl, setCertificateUrl] = useState("");
  const [pausedForCue, setPausedForCue] = useState(false);
  const triggeredCueIds = useRef<Set<string>>(new Set());

  const pendingCues = useMemo(
    () => plan.cues.filter((cue) => !progress.completedCueIds.includes(cue.id)),
    [plan.cues, progress.completedCueIds],
  );

  const progressPercent = useMemo(
    () => videoProgressPercent(plan, progress),
    [plan, progress],
  );

  const saveProgress = useCallback(async (next: VideoProgressData) => {
    if (preview || !code) return;
    const response = await fetch(`/api/video/${course.slug}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        currentSeconds: next.currentSeconds,
        maxWatchedSeconds: next.maxWatchedSeconds,
        completedCueIds: next.completedCueIds,
      }),
    });
    const payload = await response.json();
    if (response.ok && payload.certificateUrl) {
      setCertificateUrl(payload.certificateUrl);
    }
  }, [code, course.slug, preview]);

  useEffect(() => {
    if (preview || !code) return;
    fetch(`/api/video/${course.slug}/progress?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) return;
        const loaded = payload.progress as VideoProgressData;
        setProgress(loaded);
        setCurrentSeconds(loaded.currentSeconds || 0);
        if (payload.certificateUrl) setCertificateUrl(payload.certificateUrl);
        window.setTimeout(() => playerRef.current?.seekTo(loaded.currentSeconds || 0), 300);
      })
      .catch(() => undefined);
  }, [code, course.slug, preview]);

  const handleTimeUpdate = useCallback((seconds: number) => {
    setCurrentSeconds(seconds);
    setProgress((current) => {
      const next = {
        ...current,
        currentSeconds: seconds,
        maxWatchedSeconds: Math.max(current.maxWatchedSeconds, seconds),
      };
      return next;
    });

    if (activeCue || pausedForCue) return;

    const dueCue = pendingCues.find(
      (cue) => seconds >= cue.atSeconds && !triggeredCueIds.current.has(cue.id),
    );
    if (!dueCue) return;

    triggeredCueIds.current.add(dueCue.id);
    playerRef.current?.pause();
    setPausedForCue(true);
    setActiveCue(dueCue);
  }, [activeCue, pausedForCue, pendingCues]);

  const handleCueComplete = useCallback((correct: boolean) => {
    if (!activeCue || !correct) return;

    setProgress((current) => {
      const next = {
        ...current,
        completedCueIds: Array.from(new Set([...current.completedCueIds, activeCue.id])),
      };
      void saveProgress(next);
      return next;
    });
    setActiveCue(null);
    setPausedForCue(false);
    window.setTimeout(() => playerRef.current?.play(), 250);
  }, [activeCue, saveProgress]);

  const handleEnded = useCallback(() => {
    setProgress((current) => {
      const next = {
        ...current,
        maxWatchedSeconds: Math.max(current.maxWatchedSeconds, durationSeconds || current.maxWatchedSeconds),
      };
      if (videoCourseCompleted(plan, next)) {
        void saveProgress(next);
      }
      return next;
    });
  }, [durationSeconds, plan, saveProgress]);

  useEffect(() => {
    if (preview) return;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        void saveProgress(current);
        return current;
      });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [preview, saveProgress]);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#0b1f33] text-white">
      <VideoCourseTopBar
        title={course.title}
        preview={preview}
        progressPercent={progressPercent}
        currentSeconds={currentSeconds}
        durationSeconds={durationSeconds}
        activeCueLabel={activeCue ? `Pause at ${formatTimestamp(activeCue.atSeconds)}` : undefined}
        certificateUrl={certificateUrl}
      />

      <div className="relative min-h-0 flex-1">
        <YouTubePlayer
          videoId={plan.source.videoId}
          startSeconds={progress.currentSeconds}
          onReady={(handle) => {
            playerRef.current = handle;
            const duration = handle.getDuration();
            if (Number.isFinite(duration) && duration > 0) {
              setDurationSeconds(duration);
            }
            if (progress.currentSeconds > 0) {
              handle.seekTo(progress.currentSeconds);
            }
          }}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />

        {activeCue ? <VideoCuePanel cue={activeCue} onComplete={handleCueComplete} /> : null}
      </div>
    </main>
  );
}
