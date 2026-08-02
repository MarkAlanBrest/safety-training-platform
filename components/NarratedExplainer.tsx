"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
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
  const baseScale = moment.focusScale ?? 1.35;

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
    scale: Math.min(2.2, baseScale + progress * 0.45),
  };
}

function SourceImageFlipbook({
  moment,
  frames,
  active,
}: {
  moment: LessonMoment;
  frames: Frame[];
  active: number;
}) {
  const frame = frames[active];
  const focus = frameFocus(moment, frame, active, frames.length);

  return (
    <div className="relative min-h-[390px] overflow-hidden bg-[#e9eff0] lg:min-h-[460px]">
      <div key={active} className="explainer-frame absolute inset-0">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-[-15%] transition-transform duration-700 ease-out"
            style={{
              transform: `scale(${focus.scale})`,
              transformOrigin: `${focus.x}% ${focus.y}%`,
            }}
          >
            <Image
              src={moment.sourceImage!}
              alt={moment.sourceImageAlt || `${moment.title} source visual`}
              fill
              unoptimized
              className="object-cover"
              style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07111f]/95 via-[#07111f]/72 to-transparent px-6 pb-6 pt-24 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[.17em] text-[var(--accent)]">
          Frame {active + 1} of {frames.length}
          {moment.pageNumber ? ` · Source page ${moment.pageNumber}` : ""}
        </p>
        <h3 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight text-white sm:text-3xl">
          {frame.title}
        </h3>
        <p className="mt-3 max-w-3xl text-base leading-7 text-white/80 sm:text-lg">
          {frame.caption}
        </p>
      </div>
    </div>
  );
}

function ExplainerVisual({
  style,
  frames,
  active,
}: {
  style: NonNullable<LessonMoment["explainerStyle"]>;
  frames: Frame[];
  active: number;
}) {
  const frame = frames[active];

  if (style === "guided-focus") {
    return (
      <div className="grid min-h-[350px] gap-8 bg-[#f4f7f8] p-7 text-[var(--ink)] sm:p-10 md:grid-cols-[1.15fr_.85fr] md:items-center">
        <div className="relative grid min-h-[250px] place-items-center overflow-hidden rounded-[2rem] border border-[var(--ink)]/10 bg-white shadow-inner">
          <span className="absolute h-52 w-52 rounded-full border border-[var(--accent)]/35" />
          <span className="absolute h-36 w-36 rounded-full border-2 border-[var(--accent)]/70" />
          <span className="relative z-10 max-w-[240px] px-6 text-center text-2xl font-semibold leading-8">
            {frame.visualItems[0] || frame.title}
          </span>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--ink)]/45">
            Focus point {active + 1}
          </p>
          <h3 className="mt-3 text-3xl font-semibold leading-tight">{frame.title}</h3>
          <p className="mt-4 text-base leading-7 text-[var(--ink)]/70">{frame.caption}</p>
        </div>
      </div>
    );
  }

  if (style === "compare-reveal") {
    const prior = frames[Math.max(0, active - 1)];
    return (
      <div className="grid min-h-[350px] gap-px bg-[var(--ink)]/10 sm:grid-cols-2">
        <div className="bg-[#f4f7f8] p-8 text-[var(--ink)] sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--ink)]/40">
            {active === 0 ? "Starting point" : "Before"}
          </p>
          <p className="mt-7 text-2xl font-semibold leading-8 text-[var(--ink)]/55">{prior.caption}</p>
        </div>
        <div className="relative overflow-hidden bg-white p-8 text-[var(--ink)] sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Reveal</p>
          <h3 className="mt-7 text-3xl font-semibold leading-tight">{frame.title}</h3>
          <p className="mt-5 text-lg leading-8 text-[var(--ink)]/70">{frame.caption}</p>
        </div>
      </div>
    );
  }

  if (style === "step-build") {
    return (
      <div className="min-h-[350px] bg-[#f4f7f8] p-7 text-[var(--ink)] sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--ink)]/45">
          Building the idea
        </p>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {frames.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className={`relative rounded-2xl border bg-white p-5 transition-all duration-500 ${
                index <= active
                  ? "border-[var(--accent)]/60 opacity-100 shadow-sm"
                  : "border-[var(--ink)]/10 opacity-35"
              }`}
            >
              {index < active && (
                <Check className="absolute right-4 top-4 text-[var(--accent)]" size={17} />
              )}
              <span className="text-sm font-bold text-[var(--accent)]">{index + 1}</span>
              <p className="mt-5 font-semibold leading-6">{item.title}</p>
              {index === active && (
                <p className="mt-3 text-sm leading-6 text-[var(--ink)]/65">{item.caption}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[350px] overflow-hidden bg-[#f4f7f8] p-7 text-[var(--ink)] sm:p-10">
      <div key={active} className="explainer-frame">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">
          Frame {active + 1} of {frames.length}
        </p>
        <h3 className="mt-5 max-w-xl text-3xl font-semibold leading-tight">{frame.title}</h3>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--ink)]/70">{frame.caption}</p>
        <div className="mt-7 flex flex-wrap gap-2">
          {frame.visualItems.map((label) => (
            <span
              key={label}
              className="rounded-full border border-[var(--ink)]/10 bg-white px-4 py-2 text-sm font-semibold"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NarratedExplainer({ moment }: { moment: LessonMoment }) {
  const frames = useMemo(
    () => (moment.explainerFrames?.length ? moment.explainerFrames : fallbackFrames(moment)),
    [moment],
  );
  const style =
    moment.explainerStyle ||
    (moment.visualType === "anatomy"
      ? "guided-focus"
      : moment.visualType === "comparison"
        ? "compare-reveal"
        : moment.visualType === "formula"
          ? "step-build"
          : "flipbook");
  const usesSourceFlipbook = Boolean(moment.sourceImage);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  function clearAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setAudioProgress(0);
  }

  useEffect(() => () => clearAudio(), []);

  async function playFrame(index: number) {
    clearAudio();
    setActive(index);
    setLoading(true);
    try {
      const frame = frames[index];
      const response = await fetch("/api/mason/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: frame.narration }),
      });
      if (!response.ok) throw new Error("Narration unavailable");
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      urlRef.current = url;
      audioRef.current = audio;
      audio.ontimeupdate = () => {
        setAudioProgress(audio.duration ? audio.currentTime / audio.duration : 0);
      };
      audio.onended = () => {
        if (index < frames.length - 1) playFrame(index + 1);
        else {
          setPlaying(false);
          setAudioProgress(1);
        }
      };
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (loading) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else if (audioRef.current) {
      audioRef.current.play();
      setPlaying(true);
    } else {
      playFrame(active);
    }
  }

  function move(index: number) {
    clearAudio();
    setPlaying(false);
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
          {usesSourceFlipbook ? "picture flipbook" : style.replace("-", " ")}
        </span>
      </div>

      {usesSourceFlipbook ? (
        <SourceImageFlipbook moment={moment} frames={frames} active={active} />
      ) : (
        <ExplainerVisual style={style} frames={frames} active={active} />
      )}

      <div className="border-t border-white/10 bg-black/10 px-6 py-6 sm:px-8">
        <p className="min-h-14 text-sm leading-6 text-white/65">{frames[active].narration}</p>
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
              onClick={() => move(0)}
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
