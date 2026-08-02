"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import styles from "./VisualSlide.module.css";

export type VisualSlideFrame = {
  image: string;
  narration: string;
};

/**
 * Learner visual: one synchronized picture at a time with a single play control.
 * No generated artwork, titles, captions, labels, or card overlays.
 */
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
  const [slideIndex, setSlideIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [finished, setFinished] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const currentPicture = playableFrames[slideIndex]?.image ?? playableFrames[0]?.image ?? null;
  const totalProgress =
    playableFrames.length > 0
      ? ((slideIndex + audioProgress) / playableFrames.length) * 100
      : 0;
  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const speak = useCallback(
    async (index: number) => {
      const text = playableFrames[index]?.narration;
      if (!text) return;

      stopAudio();
      setLoadingAudio(true);
      setFinished(false);

      try {
        const response = await fetch("/api/mason/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
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
          if (index < playableFrames.length - 1) {
            void speak(index + 1);
          } else {
            setPlaying(false);
            setFinished(true);
            audioRef.current = null;
          }
        };

        // Change the picture at the same moment its narration begins, not while
        // the audio request is still loading.
        setSlideIndex(index);
        setAudioProgress(0);
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      } finally {
        setLoadingAudio(false);
      }
    },
    [playableFrames, stopAudio],
  );

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
    if (finished) {
      void speak(0);
      return;
    }
    void speak(slideIndex);
  }

  if (!playableFrames.length) return null;

  return (
    <div className={styles.root} data-ncst-visual="7">
      <div className={styles.frame}>
        {!currentPicture ? (
          <LoaderCircle className={styles.spinner} size={28} aria-hidden />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={slideIndex}
            src={currentPicture}
            alt=""
            className={styles.image}
            draggable={false}
          />
        )}
      </div>

      <div className={styles.playbar}>
        <button
          type="button"
          className={styles.playBtn}
          onClick={onPlayPause}
          disabled={!playableFrames.length || loadingAudio}
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
          <div className={styles.progress} style={{ width: `${totalProgress}%` }} />
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
