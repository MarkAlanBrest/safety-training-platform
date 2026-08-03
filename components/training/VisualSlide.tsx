"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import styles from "./VisualSlide.module.css";

export type VisualSlideFrame = {
  image: string;
  narration: string;
  label?: string;
};

/** Learner visual: narration-synchronized pictures, step labels, and play control. */
export default function VisualSlide({
  frames,
}: {
  frames: VisualSlideFrame[];
  courseSlug?: string;
}) {
  const playableFrames = useMemo(
    () =>
      frames.filter(
        (frame) => isPictureSource(frame.image) && frame.narration.trim(),
      ),
    [frames],
  );
  const narration = useMemo(
    () =>
      playableFrames
        .map((frame) => frame.narration.trim())
        .join("\n\n"),
    [playableFrames],
  );
  const frameStops = useMemo(() => {
    const weights = playableFrames.map((frame) =>
      Math.max(1, frame.narration.trim().split(/\s+/).length),
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let elapsed = 0;
    return weights.map((weight) => {
      elapsed += weight;
      return elapsed / total;
    });
  }, [playableFrames]);
  const [slideIndex, setSlideIndex] = useState(0);
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
    if (!narration) return;

    stopAudio();
    setLoadingAudio(true);
    setFinished(false);

    try {
      const response = await fetch("/api/mason/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: narration }),
      });
      if (!response.ok) throw new Error("speech failed");

      const url = URL.createObjectURL(await response.blob());
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        const progress = audio.duration ? audio.currentTime / audio.duration : 0;
        setAudioProgress(progress);
        const nextIndex = frameStops.findIndex((stop) => progress < stop);
        setSlideIndex(nextIndex < 0 ? playableFrames.length - 1 : nextIndex);
      };
      audio.onended = () => {
        setAudioProgress(1);
        setSlideIndex(playableFrames.length - 1);
        setPlaying(false);
        setFinished(true);
        audioRef.current = null;
      };

      setAudioProgress(0);
      setSlideIndex(0);
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    } finally {
      setLoadingAudio(false);
    }
  }, [frameStops, narration, playableFrames.length, stopAudio]);

  function onPlayPause() {
    if (loadingAudio || !playableFrames.length) return;
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
    void speak();
  }

  if (!playableFrames.length) return null;

  const currentFrame = playableFrames[slideIndex] ?? playableFrames[0];
  const currentLabel = currentFrame.label?.trim();

  return (
    <div className={styles.root} data-ncst-visual="11">
      <div className={styles.frame}>
        {playableFrames.map((frame, index) => (
          <div
            key={`${frame.image}-${index}`}
            className={`${styles.imageLayer} ${
              index === slideIndex ? styles.imageLayerActive : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.image}
              alt=""
              className={styles.image}
              draggable={false}
            />
          </div>
        ))}

        {(currentLabel || playableFrames.length > 1) && (
          <div className={styles.labelBar}>
            {currentLabel ? (
              <span className={styles.labelPill}>
                <span className={styles.labelStep}>{slideIndex + 1}</span>
                {currentLabel}
              </span>
            ) : (
              <span />
            )}
            {playableFrames.length > 1 && (
              <div className={styles.dots} aria-hidden="true">
                {playableFrames.map((frame, index) => (
                  <span
                    key={`dot-${frame.image}-${index}`}
                    className={`${styles.dot} ${
                      index === slideIndex ? styles.dotActive : ""
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
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
          <div
            className={styles.progress}
            style={{ width: `${audioProgress * 100}%` }}
          />
        </div>
        {playableFrames.length > 1 && (
          <span className={styles.frameCounter}>
            {slideIndex + 1}/{playableFrames.length}
          </span>
        )}
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
