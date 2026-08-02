"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Volume2,
} from "lucide-react";
import type { LessonMoment } from "@/lib/mason";

type Frame = {
  title: string;
  caption: string;
  narration: string;
  visualItems: string[];
  focusX?: number | null;
  focusY?: number | null;
  focusScale?: number | null;
};

type FrameFocus = {
  x: number;
  y: number;
  scale: number;
};

function fallbackFrames(moment: LessonMoment): Frame[] {
  const items = moment.visualItems?.filter(Boolean).slice(0, 5) || [];
  if (items.length) {
    return items.map((item, index) => ({
      title: `${moment.title} · ${index + 1}`,
      caption: item,
      narration: `${item}. ${index === 0 ? moment.narration : ""}`.trim(),
      visualItems: [item],
    }));
  }
  return [
    {
      title: moment.title,
      caption: moment.cue || "Follow the key idea as the explanation unfolds.",
      narration: moment.narration,
      visualItems: [moment.title],
    },
  ];
}

function frameFocus(
  moment: LessonMoment,
  frame: Frame,
  frameIndex: number,
  totalFrames: number,
): FrameFocus {
  if (
    typeof frame.focusX === "number" &&
    typeof frame.focusY === "number" &&
    typeof frame.focusScale === "number"
  ) {
    return {
      x: frame.focusX,
      y: frame.focusY,
      scale: frame.focusScale,
    };
  }

  const baseX = moment.focusX ?? 50;
  const baseY = moment.focusY ?? 50;
  const baseScale = moment.focusScale ?? 1.25;

  if (totalFrames <= 1) {
    return { x: baseX, y: baseY, scale: baseScale };
  }

  const progress = frameIndex / Math.max(1, totalFrames - 1);
  const columns = Math.min(3, totalFrames);
  const row = Math.floor(frameIndex / columns);
  const column = frameIndex % columns;
  const columnSpan = 70 / Math.max(1, columns - 1);

  return {
    x: Math.min(85, Math.max(15, 15 + column * columnSpan)),
    y: Math.min(80, Math.max(20, baseY - 10 + row * 18)),
    scale: Math.min(2.2, baseScale + progress * 0.35),
  };
}

function FlipbookStage({
  moment,
  frames,
  active,
  sourceImage,
}: {
  moment: LessonMoment;
  frames: Frame[];
  active: number;
  sourceImage?: string | null;
}) {
  const frame = frames[active];
  const focus = frameFocus(moment, frame, active, frames.length);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [sourceImage]);

  const showPicture = Boolean(sourceImage) && !imageFailed;

  return (
    <div className="relative min-h-[390px] overflow-hidden bg-white lg:min-h-[460px]">
      {showPicture ? (
        <div className="absolute inset-0 overflow-hidden bg-[#f4f7f8]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sourceImage!}
            alt={moment.sourceImageAlt || `${moment.title} source visual`}
            className="flipbook-pan absolute inset-0 h-full w-full object-contain"
            style={{
              transform: `scale(${focus.scale})`,
              transformOrigin: `${focus.x}% ${focus.y}%`,
            }}
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#e9eff0] via-[#f4f7f8] to-[#dfe8ea]" />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07111f]/95 via-[#07111f]/75 to-transparent px-6 pb-6 pt-28 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[.17em] text-[var(--accent)]">
          {showPicture ? "Picture" : "Visual"} {active + 1} of {frames.length}
          {moment.pageNumber ? ` · Source page ${moment.pageNumber}` : ""}
        </p>
        <h3 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight text-white sm:text-3xl">
          {frame.title}
        </h3>
        <p className="mt-3 max-w-3xl text-base leading-7 text-white/85 sm:text-lg">
          {frame.caption}
        </p>
        {!showPicture && frame.visualItems.length > 0 && (
          <p className="mt-4 max-w-3xl text-sm leading-6 text-white/60">
            {frame.visualItems.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

export default function NarratedExplainer({ moment }: { moment: LessonMoment }) {
  const frames = useMemo(
    () => (moment.explainerFrames?.length ? moment.explainerFrames : fallbackFrames(moment)),
    [moment],
  );
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const preloadRef = useRef<{ index: number; url: string; audio: HTMLAudioElement } | null>(
    null,
  );

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
    const audio = new Audio(url);
    return { url, audio };
  }, []);

  const preloadFrame = useCallback(
    async (index: number) => {
      if (index >= frames.length || preloadRef.current?.index === index) return;
      clearPreload();
      try {
        const { url, audio } = await fetchNarration(frames[index].narration);
        preloadRef.current = { index, url, audio };
      } catch {
        // Preload is best-effort.
      }
    },
    [clearPreload, fetchNarration, frames],
  );

  const playFrame = useCallback(
    async (index: number) => {
      clearAudio();
      setActive(index);
      setLoading(true);
      setVoiceError(null);

      try {
        let url: string;
        let audio: HTMLAudioElement;

        if (preloadRef.current?.index === index) {
          ({ url, audio } = preloadRef.current);
          preloadRef.current = null;
        } else {
          clearPreload();
          ({ url, audio } = await fetchNarration(frames[index].narration));
        }

        urlRef.current = url;
        audioRef.current = audio;
        audio.ontimeupdate = () => {
          setAudioProgress(audio.duration ? audio.currentTime / audio.duration : 0);
          if (
            audio.duration &&
            audio.currentTime / audio.duration > 0.55 &&
            index < frames.length - 1
          ) {
            void preloadFrame(index + 1);
          }
        };
        audio.onended = () => {
          if (index < frames.length - 1) {
            void playFrame(index + 1);
          } else {
            setPlaying(false);
            setAudioProgress(1);
          }
        };
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
        setVoiceError("Audio could not be prepared. You can still step through the pictures.");
      } finally {
        setLoading(false);
      }
    },
    [clearAudio, clearPreload, fetchNarration, frames, preloadFrame],
  );

  function toggle() {
    if (loading) return;
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

  function move(index: number) {
    clearAudio();
    clearPreload();
    setPlaying(false);
    setVoiceError(null);
    setActive(Math.max(0, Math.min(frames.length - 1, index)));
  }

  const overallProgress = ((active + audioProgress) / frames.length) * 100;

  return (
    <div className="overflow-hidden rounded-3xl bg-[var(--dark)] text-white shadow-[0_30px_80px_rgba(15,23,42,.22)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5 sm:px-8">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-white/55">
          <Volume2 size={15} className="text-[var(--accent)]" /> Narrated visual explainer
        </p>
        <span className="rounded-full bg-white/[.07] px-3 py-1 text-xs font-semibold text-white/50">
          picture flipbook
        </span>
      </div>

      <FlipbookStage
        moment={moment}
        frames={frames}
        active={active}
        sourceImage={moment.sourceImage}
      />

      <div className="border-t border-white/10 bg-black/10 px-6 py-6 sm:px-8">
        <p className="min-h-14 text-sm leading-6 text-white/65">{frames[active].narration}</p>
        {voiceError && (
          <p className="mt-3 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {voiceError}
          </p>
        )}
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => move(active - 1)}
              disabled={active === 0}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/70 disabled:opacity-25"
              aria-label="Previous frame"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={toggle}
              className="flex h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-[var(--dark)]"
            >
              {loading ? (
                <LoaderCircle className="animate-spin" size={19} />
              ) : playing ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
              {loading ? "Preparing…" : playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => move(active + 1)}
              disabled={active === frames.length - 1}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/70 disabled:opacity-25"
              aria-label="Next frame"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                move(0);
                void playFrame(0);
              }}
              className="grid h-10 w-10 place-items-center rounded-full text-white/45 hover:text-white"
              aria-label="Replay from beginning"
            >
              <RotateCcw size={17} />
            </button>
          </div>
          <div className="hidden gap-1.5 sm:flex">
            {frames.map((frame, index) => (
              <button
                type="button"
                key={`${frame.title}-${index}`}
                onClick={() => move(index)}
                className={`h-2 rounded-full transition-all ${
                  index === active ? "w-7 bg-[var(--accent)]" : "w-2 bg-white/20"
                }`}
                aria-label={`Show frame ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
