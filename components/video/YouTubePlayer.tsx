"use client";

import { useEffect, useRef, useState } from "react";

type YouTubePlayerInstance = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

type YouTubePlayerEvent = {
  target: YouTubePlayerInstance;
  data?: number;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: YouTubePlayerEvent) => void;
            onStateChange?: (event: YouTubePlayerEvent) => void;
          };
        },
      ) => YouTubePlayerInstance;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector('script[data-youtube-iframe-api="true"]');
    if (existing) {
      const check = () => {
        if (window.YT?.Player) resolve();
        else window.setTimeout(check, 50);
      };
      check();
      return;
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.youtubeIframeApi = "true";
    document.body.appendChild(script);
  });

  return youtubeApiPromise;
}

export type YouTubePlayerHandle = {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
};

export default function YouTubePlayer({
  videoId,
  startSeconds = 0,
  onReady,
  onTimeUpdate,
  onEnded,
  onStateChange,
}: {
  videoId: string;
  startSeconds?: number;
  onReady?: (handle: YouTubePlayerHandle) => void;
  onTimeUpdate?: (seconds: number) => void;
  onEnded?: () => void;
  onStateChange?: (state: "playing" | "paused" | "ended") => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval: number | null = null;

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: Math.max(0, Math.floor(startSeconds)),
          ...(typeof window !== "undefined" ? { origin: window.location.origin } : {}),
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            setReady(true);
            const handle: YouTubePlayerHandle = {
              play: () => event.target.playVideo(),
              pause: () => event.target.pauseVideo(),
              seekTo: (seconds) => event.target.seekTo(seconds, true),
              getCurrentTime: () => event.target.getCurrentTime(),
              getDuration: () => event.target.getDuration(),
            };
            onReady?.(handle);
          },
          onStateChange: (event) => {
            if (cancelled) return;
            const state = event.data;
            if (state === window.YT?.PlayerState.PLAYING) onStateChange?.("playing");
            if (state === window.YT?.PlayerState.PAUSED) onStateChange?.("paused");
            if (state === window.YT?.PlayerState.ENDED) {
              onStateChange?.("ended");
              onEnded?.();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    if (!ready || !onTimeUpdate) return;
    const timer = window.setInterval(() => {
      const seconds = playerRef.current?.getCurrentTime();
      if (typeof seconds === "number") onTimeUpdate(seconds);
    }, 250);
    return () => window.clearInterval(timer);
  }, [ready, onTimeUpdate]);

  return (
    <div className="relative h-full w-full bg-black">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
