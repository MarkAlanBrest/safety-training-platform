"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import styles from "./VisualSlide.module.css";

export type VisualSlideFrame = {
  image: string;
  narration: string;
};

/** Learner visual: one picture, one narration, and one play control. */
export default function VisualSlide({
  frames,
}: {
  frames: VisualSlideFrame[];
  courseSlug?: string;
}) {
  const explainer = useMemo(() => {
    const image = frames.find((frame) => isPictureSource(frame.image))?.image;
    const narration = frames
      .map((frame) => frame.narration.trim())
      .filter(Boolean)
      .join("\n\n");

    return image && narration ? { image, narration } : null;
  }, [frames]);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [finished, setFinished] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const speak = useCallback(async () => {
    if (!explainer?.narration) return;

    stopAudio();
    setLoadingAudio(true);
    setFinished(false);

    try {
      const response = await fetch("/api/mason/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: explainer.narration }),
      });
      if (!response.ok) throw new Error("speech failed");

      const url = URL.createObjectURL(await response.blob());
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        setAudioProgress(audio.duration ? audio.currentTime / audio.duration : 0);
      };
      audio.onended = () => {
        setAudioProgress(1);
        setPlaying(false);
        setFinished(true);
        audioRef.current = null;
      };

      setAudioProgress(0);
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    } finally {
      setLoadingAudio(false);
    }
  }, [explainer, stopAudio]);

  function onPlayPause() {
    if (loadingAudio || !explainer) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (audioRef.current) {
      void audioRef.current.play();
      setPlaying(true);
      return;
    }
    if (finished) {
      void speak();
      return;
    }
    void speak();
  }

  if (!explainer) return null;

  return (
    <div className={styles.root} data-ncst-visual="9">
      <div className={styles.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={explainer.image} alt="" className={styles.image} draggable={false} />
      </div>

      <div className={styles.playbar}>
        <button
          type="button"
          className={styles.playBtn}
          onClick={onPlayPause}
          disabled={loadingAudio}
          aria-label={playing ? "Pause" : "Play"}
        >
          {loadingAudio ? (
            <LoaderCircle className={styles.spinnerDark} size={18} />
          ) : playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className={styles.playIcon} />
          )}
        </button>
        <div className={styles.track} aria-hidden="true">
          <div className={styles.progress} style={{ width: `${audioProgress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

export function isPictureSource(source: string) {
  const value = source.trim().toLowerCase();
  return (
    value.startsWith("data:image/") ||
    value.startsWith("blob:") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/")
  );
}
