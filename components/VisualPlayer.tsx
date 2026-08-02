"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import {
  sanitizeVisualMomentForLearner,
  type LessonMoment,
} from "@/lib/mason";
import {
  buildFramePicture,
  isEmbeddedPicture,
  themeFromCourseSlug,
} from "@/lib/visual-frame-art";

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

type FrameFocus = { x: number; y: number; scale: number };

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
    return { x: frame.focusX, y: frame.focusY, scale: frame.focusScale };
  }

  const baseX = moment.focusX ?? 50;
  const baseY = moment.focusY ?? 50;
  const baseScale = moment.focusScale ?? 1.45;

  if (totalFrames <= 1) return { x: baseX, y: baseY, scale: baseScale };

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

function cropImageFromSource(sourceImage: string, focus: FrameFocus): Promise<string> {
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
      context.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    image.onerror = () => reject(new Error("Image failed to load"));
    image.src = sourceImage;
  });
}

async function resolveFrameImages(
  moment: LessonMoment,
  frames: Frame[],
  theme: string,
): Promise<string[]> {
  const images: string[] = [];

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    if (isEmbeddedPicture(frame.sourceImage)) {
      images.push(frame.sourceImage!);
      continue;
    }

    if (isEmbeddedPicture(moment.sourceImage)) {
      try {
        images.push(
          await cropImageFromSource(
            moment.sourceImage!,
            frameFocus(moment, frame, index, frames.length),
          ),
        );
        continue;
      } catch {
        // Fall through.
      }
    }

    images.push(buildFramePicture(theme, index));
  }

  return images;
}

/** Picture on top, thin play strip underneath. No text, overlays, or cards. */
export default function VisualPlayer({
  moment,
  courseSlug,
}: {
  moment: LessonMoment;
  courseSlug?: string;
}) {
  const learnerMoment = useMemo(() => sanitizeVisualMomentForLearner(moment), [moment]);
  const theme = themeFromCourseSlug(courseSlug);
  const frames = useMemo(() => {
    if (learnerMoment.explainerFrames?.length) return learnerMoment.explainerFrames;
    if (learnerMoment.sourceImage || learnerMoment.narration) {
      return [
        {
          title: "",
          caption: "",
          narration: learnerMoment.narration,
          visualItems: [] as string[],
        },
      ];
    }
    return [];
  }, [learnerMoment]);

  const [pictures, setPictures] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const preloadRef = useRef<{ index: number; url: string; audio: HTMLAudioElement } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setActive(0);
    setAudioProgress(0);

    void resolveFrameImages(learnerMoment, frames, theme).then((images) => {
      if (cancelled) return;
      setPictures(images);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [learnerMoment, frames, theme]);

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
      if (index >= frames.length || preloadRef.current?.index === index) return;
      clearPreload();
      try {
        const { url, audio } = await fetchNarration(frames[index].narration);
        preloadRef.current = { index, url, audio };
      } catch {
        // Best effort.
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
          setAudioProgress(1);
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
    <div className="visual-player w-full" data-visual-player="pictures-only-v5">
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
