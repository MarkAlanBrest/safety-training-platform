"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import type { LessonMoment } from "@/lib/mason";

type Frame = {
  title: string;
  caption: string;
  narration: string;
  visualItems: string[];
  focusX?: number | null;
  focusY?: number | null;
  focusScale?: number | null;
  sourceImage?: string | null;
};

type FrameFocus = {
  x: number;
  y: number;
  scale: number;
};

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
  const baseScale = moment.focusScale ?? 1.45;

  if (totalFrames <= 1) {
    return { x: baseX, y: baseY, scale: baseScale };
  }

  const columns = Math.min(3, totalFrames);
  const row = Math.floor(frameIndex / columns);
  const column = frameIndex % columns;
  const columnSpan = 70 / Math.max(1, columns - 1);

  return {
    x: Math.min(85, Math.max(15, 15 + column * columnSpan)),
    y: Math.min(80, Math.max(20, baseY - 12 + row * 22)),
    scale: Math.min(2.4, baseScale + frameIndex * 0.18),
  };
}

function cropImageFromSource(
  sourceImage: string,
  focus: FrameFocus,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const cx = (focus.x / 100) * width;
      const cy = (focus.y / 100) * height;
      const cropWidth = Math.min(width, width / focus.scale);
      const cropHeight = Math.min(height, cropWidth / (16 / 9));
      const sx = Math.max(0, Math.min(width - cropWidth, cx - cropWidth / 2));
      const sy = Math.max(0, Math.min(height - cropHeight, cy - cropHeight / 2));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(cropWidth));
      canvas.height = Math.max(1, Math.round(cropHeight));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      context.drawImage(
        image,
        sx,
        sy,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => reject(new Error("Image failed to load"));
    image.src = sourceImage;
  });
}

async function resolveFrameImages(
  moment: LessonMoment,
  frames: Frame[],
): Promise<string[]> {
  const images: string[] = [];

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    if (frame.sourceImage) {
      images.push(frame.sourceImage);
      continue;
    }

    if (!moment.sourceImage) continue;

    try {
      images.push(
        await cropImageFromSource(
          moment.sourceImage,
          frameFocus(moment, frame, index, frames.length),
        ),
      );
    } catch {
      if (index === 0) images.push(moment.sourceImage);
    }
  }

  return images;
}

function PictureStage({
  image,
  loading,
}: {
  image: string | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center bg-[#eef2f3] sm:aspect-[16/9]">
        <LoaderCircle className="animate-spin text-[var(--accent)]" size={36} />
      </div>
    );
  }

  if (!image) {
    return (
      <div className="aspect-[16/10] bg-[#eef2f3] sm:aspect-[16/9]" aria-hidden />
    );
  }

  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-[#eef2f3] sm:aspect-[16/9]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        className="flipbook-frame absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}

export default function NarratedExplainer({ moment }: { moment: LessonMoment }) {
  const frames = useMemo(() => {
    if (moment.explainerFrames?.length) return moment.explainerFrames;
    if (moment.sourceImage) {
      return [
        {
          title: moment.title,
          caption: "",
          narration: moment.narration,
          visualItems: [] as string[],
        },
      ];
    }
    return [];
  }, [moment]);
  const [pictures, setPictures] = useState<string[]>([]);
  const [picturesLoading, setPicturesLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const preloadRef = useRef<{ index: number; url: string; audio: HTMLAudioElement } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setPicturesLoading(true);
    setActive(0);

    void resolveFrameImages(moment, frames).then((images) => {
      if (cancelled) return;
      setPictures(images);
      setPicturesLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [moment, frames]);

  const clearAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
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
      if (!frames.length || index >= frames.length) return;

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
          ({ url, audio } = await fetchNarration(frames[index].narration));
        }

        urlRef.current = url;
        audioRef.current = audio;
        audio.ontimeupdate = () => {
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
    [clearAudio, clearPreload, fetchNarration, frames, preloadFrame],
  );

  function toggle() {
    if (audioLoading || picturesLoading || !pictures.length) return;
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
  const canPlay = pictures.length > 0 && frames.length > 0;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#eef2f3] shadow-[0_20px_60px_rgba(15,23,42,.12)]">
      <PictureStage image={currentPicture} loading={picturesLoading} />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          onClick={toggle}
          disabled={!canPlay || audioLoading}
          className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full bg-white/95 text-[var(--dark)] shadow-lg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={
            audioLoading ? "Preparing narration" : playing ? "Pause visual explainer" : "Play visual explainer"
          }
        >
          {audioLoading ? (
            <LoaderCircle className="animate-spin" size={28} />
          ) : playing ? (
            <Pause size={28} fill="currentColor" />
          ) : (
            <Play size={28} fill="currentColor" className="ml-1" />
          )}
        </button>
      </div>
    </div>
  );
}
