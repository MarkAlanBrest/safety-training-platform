"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Captions, MessageCircle, Pause, Play } from "lucide-react";
import type { VideoChapter, VideoTimelineMarker } from "@/lib/classroom-video";
import { chapterAtTime, formatTimestamp } from "@/lib/classroom-video";

export type VideoClassroomPlayerHandle = {
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
};

type Props = {
  title: string;
  videoUrl: string;
  captionsUrl?: string;
  chapters: VideoChapter[];
  markers: VideoTimelineMarker[];
  onMarkerReached: (marker: VideoTimelineMarker) => void;
  onAskAi: () => void;
  pausedExternally?: boolean;
};

const VideoClassroomPlayer = forwardRef<VideoClassroomPlayerHandle, Props>(
  function VideoClassroomPlayer(
    {
      title,
      videoUrl,
      captionsUrl,
      chapters,
      markers,
      onMarkerReached,
      onAskAi,
      pausedExternally = false,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const firedMarkersRef = useRef<Set<string>>(new Set());
    const [playing, setPlaying] = useState(false);
    const [captionsOn, setCaptionsOn] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [chapterMenuOpen, setChapterMenuOpen] = useState(false);

    const activeChapter = chapterAtTime(chapters, currentTime);

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      seekTo: (seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = seconds;
        resetFiredMarkers(seconds);
      },
      play: () => {
        void videoRef.current?.play();
      },
      pause: () => {
        videoRef.current?.pause();
      },
      setMuted: (muted: boolean) => {
        if (videoRef.current) videoRef.current.muted = muted;
      },
      isMuted: () => videoRef.current?.muted ?? false,
    }));

    const resetFiredMarkers = useCallback(
      (time: number) => {
        firedMarkersRef.current = new Set(
          [...firedMarkersRef.current].filter((id) => {
            const marker = markers.find((item) => item.id === id);
            return marker ? marker.atSeconds <= time - 0.25 : false;
          }),
        );
      },
      [markers],
    );

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      for (const track of video.textTracks) {
        track.mode = captionsOn ? "showing" : "hidden";
      }
    }, [captionsOn, captionsUrl]);

    useEffect(() => {
      if (pausedExternally) videoRef.current?.pause();
    }, [pausedExternally]);

    function handleTimeUpdate() {
      const video = videoRef.current;
      if (!video) return;
      const time = video.currentTime;
      setCurrentTime(time);

      for (const marker of markers) {
        if (time + 0.15 < marker.atSeconds) continue;
        if (firedMarkersRef.current.has(marker.id)) continue;
        firedMarkersRef.current.add(marker.id);
        video.pause();
        setPlaying(false);
        onMarkerReached(marker);
        return;
      }
    }

    function togglePlay() {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        void video.play();
        setPlaying(true);
      } else {
        video.pause();
        setPlaying(false);
      }
    }

    function seekToChapter(chapter: VideoChapter) {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = chapter.startSeconds;
      resetFiredMarkers(chapter.startSeconds);
      setChapterMenuOpen(false);
      void video.play();
      setPlaying(true);
    }

    return (
      <div className="relative flex h-full min-h-0 w-full flex-col bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className="min-h-0 w-full flex-1 object-contain"
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        >
          {captionsUrl ? (
            <track
              kind="captions"
              src={captionsUrl}
              srcLang="en"
              label="English"
              default
            />
          ) : null}
        </video>

        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-4">
          <div className="pointer-events-auto flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{title}</p>
              {activeChapter ? (
                <p className="truncate text-xs text-white/70">{activeChapter.title}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {chapters.length > 0 ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setChapterMenuOpen((open) => !open)}
                    className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-white/25"
                  >
                    Chapters
                  </button>
                  {chapterMenuOpen ? (
                    <div className="absolute right-0 top-full z-20 mt-2 max-h-64 w-56 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl">
                      {chapters.map((chapter) => (
                        <button
                          key={chapter.id}
                          type="button"
                          onClick={() => seekToChapter(chapter)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                        >
                          <span className="truncate">{chapter.title}</span>
                          <span className="ml-2 shrink-0 text-xs text-white/50">
                            {formatTimestamp(chapter.startSeconds)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {captionsUrl ? (
                <button
                  type="button"
                  onClick={() => setCaptionsOn((on) => !on)}
                  className={`grid h-9 w-9 place-items-center rounded-lg backdrop-blur ${
                    captionsOn ? "bg-amber-400 text-slate-950" : "bg-white/15 text-white"
                  }`}
                  aria-label={captionsOn ? "Hide captions" : "Show captions"}
                >
                  <Captions size={18} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onAskAi}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950"
              >
                <MessageCircle size={16} /> Ask AI
              </button>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-950"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={currentTime}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  const video = videoRef.current;
                  if (!video) return;
                  video.currentTime = next;
                  resetFiredMarkers(next);
                  setCurrentTime(next);
                }}
                className="w-full accent-amber-400"
                aria-label="Seek"
              />
              <div className="mt-1 flex justify-between text-[11px] font-semibold tabular-nums text-white/70">
                <span>{formatTimestamp(currentTime)}</span>
                <span>{formatTimestamp(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default VideoClassroomPlayer;
