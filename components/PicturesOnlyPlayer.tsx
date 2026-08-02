"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import { buildFramePicture, isEmbeddedPicture, themeFromCourseSlug } from "@/lib/visual-frame-art";

export type PictureFrame = {
  image: string;
  narration: string;
};

/** Learner visual player: pictures + play bar only. Accepts stripped frame payloads. */
export default function PicturesOnlyPlayer({
  frames,
  courseSlug,
}: {
  frames: PictureFrame[];
  courseSlug?: string;
}) {
  const theme = themeFromCourseSlug(courseSlug);
  const [pictures, setPictures] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const preloadRef = useRef<{ index: number; url: string; audio: HTMLAudioElement } | null>(null);

  const narrations = useMemo(() => frames.map((frame) => frame.narration), [frames]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setActive(0);
    setAudioProgress(0);

    const images = frames.map((frame, index) =>
      isEmbeddedPicture(frame.image) ? frame.image : buildFramePicture(theme, index),
    );

    if (!cancelled) {
      setPictures(images);
      setReady(true);
    }

    return () => {
      cancelled = true;
    };
  }, [frames, theme]);

  const clearAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setAudioProgress(0);
  }, []);

  const clearPreload = useCallback(() => {
    preloadRef.current?.audio.pause();
    if (preloadRef.current?.url) URL.revokeObjectURL(preloadRef.current.url);
    preloadRef.current = null;
  }, []);

  useEffect(
    () => () => {
      clearAudio();
      clearPreload();
    },
    [clearAudio, clearPreload],
  );

  const fetchNarration = useCallback(async (text: string) => {
    const response = await fetch("/api/mason/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error("Narration unavailable");
    const url = URL.createObjectURL(await response.blob());
    return { url, audio: new Audio(url) };
  }, []);

  const preloadFrame = useCallback(
    async (index: number) => {
      if (index >= narrations.length || preloadRef.current?.index === index) return;
      clearPreload();
      try {
        const { url, audio } = await fetchNarration(narrations[index]);
        preloadRef.current = { index, url, audio };
      } catch {
        // Best effort.
      }
    },
    [clearPreload, fetchNarration, narrations],
  );

  const playFrame = useCallback(
    async (index: number) => {
      if (!narrations.length || index >= narrations.length) return;

      clearAudio();
      setActive(index);
      setAudioLoading(true);

      try {
        let url: string;
        let audio: HTMLAudioElement;

        if (preloadRef.current?.index === index) {
          ({ url, audio } = preloadRef.current);
          preloadRef.current = null;
        } else {
          clearPreload();
          ({ url, audio } = await fetchNarration(narrations[index]));
        }

        urlRef.current = url;
        audioRef.current = audio;
        audio.ontimeupdate = () => {
          setAudioProgress(audio.duration ? audio.currentTime / audio.duration : 0);
          if (
            audio.duration &&
            audio.currentTime / audio.duration > 0.55 &&
            index < narrations.length - 1
          ) {
            void preloadFrame(index + 1);
          }
        };
        audio.onended = () => {
          setAudioProgress(1);
          if (index < narrations.length - 1) {
            void playFrame(index + 1);
          } else {
            setPlaying(false);
          }
        };
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      } finally {
        setAudioLoading(false);
      }
    },
    [clearAudio, clearPreload, fetchNarration, narrations, preloadFrame],
  );

  function toggle() {
    if (audioLoading || !ready || !pictures.length) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else if (audioRef.current) {
      void audioRef.current.play();
      setPlaying(true);
    } else {
      void playFrame(active);
    }
  }

  const currentPicture = pictures[active] || pictures[0] || null;
  const totalProgress =
    pictures.length > 0 ? ((active + audioProgress) / pictures.length) * 100 : 0;

  return (
    <div className="pictures-only-player w-full" data-visual-player="pictures-only-v6">
      <div className="relative w-full bg-black" style={{ aspectRatio: "16 / 9" }}>
        {!ready || !currentPicture ? (
          <div className="absolute inset-0 grid place-items-center">
            <LoaderCircle className="animate-spin text-white/60" size={28} aria-hidden />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={currentPicture.slice(0, 64)}
            src={currentPicture}
            alt=""
            className="block h-full w-full object-cover"
            draggable={false}
          />
        )}
      </div>

      <div className="flex h-12 items-center gap-3 bg-neutral-950 px-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!ready || !pictures.length || audioLoading}
          className="grid h-9 w-9 shrink-0 place-items-center text-white disabled:opacity-40"
          aria-label={playing ? "Pause" : "Play"}
        >
          {audioLoading ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20" aria-hidden>
          <div
            className="h-full rounded-full bg-white transition-[width] duration-200"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
