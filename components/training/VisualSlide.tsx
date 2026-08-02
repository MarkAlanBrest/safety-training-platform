"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import { buildFramePicture, isEmbeddedPicture, themeFromCourseSlug } from "@/lib/visual-frame-art";
import styles from "./VisualSlide.module.css";

export type VisualSlideFrame = {
  image: string;
  narration: string;
};

/**
 * Rebuilt learner visual: one picture at a time + play bar. No titles, captions, or labels.
 */
export default function VisualSlide({
  frames,
  courseSlug,
}: {
  frames: VisualSlideFrame[];
  courseSlug?: string;
}) {
  const theme = themeFromCourseSlug(courseSlug);
  const [slideIndex, setSlideIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const pictures = frames.map((frame, index) =>
    isEmbeddedPicture(frame.image) ? frame.image : buildFramePicture(theme, index),
  );
  const currentPicture = pictures[slideIndex] ?? pictures[0] ?? null;
  const barProgress =
    pictures.length > 0 ? ((slideIndex + audioProgress) / pictures.length) * 100 : 0;

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setAudioProgress(0);
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const speak = useCallback(
    async (index: number) => {
      const text = frames[index]?.narration;
      if (!text) return;

      stopAudio();
      setSlideIndex(index);
      setLoadingAudio(true);

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
          if (index < frames.length - 1) {
            void speak(index + 1);
          } else {
            setPlaying(false);
          }
        };

        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      } finally {
        setLoadingAudio(false);
      }
    },
    [frames, stopAudio],
  );

  function onPlayPause() {
    if (loadingAudio || !frames.length) return;
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
    void speak(slideIndex);
  }

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

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.playBtn}
          onClick={onPlayPause}
          disabled={!frames.length || loadingAudio}
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
        <div className={styles.track} aria-hidden>
          <div className={styles.fill} style={{ width: `${barProgress}%` }} />
        </div>
      </div>
    </div>
  );
}
