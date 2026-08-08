"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Captions, Pause, Play } from "lucide-react";
import type { VideoChapter, VideoTimelineMarker } from "@/lib/classroom-video";
import { formatTimestamp } from "@/lib/classroom-video";

export type VideoClassroomPlayerHandle = {
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  resetMarkers: () => void;
};

type Props = {
  videoUrl: string;
  captionsUrl?: string;
  markers: VideoTimelineMarker[];
  onMarkerReached: (marker: VideoTimelineMarker) => void;
  onPlaybackUpdate?: (state: { currentTime: number; duration: number }) => void;
  onPlaybackError?: (message: string) => void;
  markersActive?: boolean;
  pausedExternally?: boolean;
};

const VideoClassroomPlayer = forwardRef<VideoClassroomPlayerHandle, Props>(
  function VideoClassroomPlayer(
    {
      videoUrl,
      captionsUrl,
      markers,
      onMarkerReached,
      onPlaybackUpdate,
      onPlaybackError,
      markersActive = false,
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

    const clearFiredMarkers = useCallback(() => {
      firedMarkersRef.current = new Set();
    }, []);

    const playVideo = useCallback(async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        await video.play();
        setPlaying(true);
      } catch {
        onPlaybackError?.("Tap play to start the video.");
        setPlaying(false);
      }
    }, [onPlaybackError]);

    useImperativeHandle(
      ref,
      () => ({
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
        seekTo: (seconds: number) => {
          const video = videoRef.current;
          if (!video) return;
          video.currentTime = seconds;
          resetFiredMarkers(seconds);
          setCurrentTime(seconds);
        },
        play: playVideo,
        pause: () => {
          videoRef.current?.pause();
          setPlaying(false);
        },
        setMuted: (muted: boolean) => {
          if (videoRef.current) videoRef.current.muted = muted;
        },
        isMuted: () => videoRef.current?.muted ?? false,
        resetMarkers: clearFiredMarkers,
      }),
      [clearFiredMarkers, playVideo, resetFiredMarkers],
    );

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      for (const track of video.textTracks) {
        track.mode = captionsOn ? "showing" : "hidden";
      }
    }, [captionsOn, captionsUrl]);

    useEffect(() => {
      if (pausedExternally) {
        videoRef.current?.pause();
        setPlaying(false);
      }
    }, [pausedExternally]);

    function handleTimeUpdate() {
      const video = videoRef.current;
      if (!video) return;
      const time = video.currentTime;
      setCurrentTime(time);
      onPlaybackUpdate?.({ currentTime: time, duration: video.duration || duration });

      if (!markersActive || video.paused) return;

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

    async function togglePlay() {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        await playVideo();
      } else {
        video.pause();
        setPlaying(false);
      }
    }

    return (
      <div className="relative flex h-full min-h-0 w-full flex-col bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className="min-h-0 w-full flex-1 object-contain"
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            const nextDuration = event.currentTarget.duration || 0;
            setDuration(nextDuration);
            onPlaybackUpdate?.({
              currentTime: event.currentTarget.currentTime,
              duration: nextDuration,
            });
          }}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() =>
            onPlaybackError?.(
              "This video could not be loaded. Try republishing the course or uploading a smaller MP4.",
            )
          }
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

        {captionsUrl ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent px-4 pb-8 pt-4">
            <div className="pointer-events-auto flex justify-end">
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
            </div>
          </div>
        ) : null}

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
                  onPlaybackUpdate?.({ currentTime: next, duration: video.duration || duration });
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
