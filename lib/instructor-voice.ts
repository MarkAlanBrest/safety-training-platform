"use client";

import { useCallback, useRef, useState } from "react";
import { speechChunks } from "@/lib/classroom-speech";

const MAX_STREAMABLE_SPEECH_LENGTH = 1500;

export type InstructorVoiceSettings = {
  enabled: boolean;
  provider: "browser" | "premium";
  voice: string;
  speed: number;
};

export function useInstructorVoice(voiceSettings: InstructorVoiceSettings) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakQueueRef = useRef<Promise<void>>(Promise.resolve());
  const speechGenerationRef = useRef(0);
  const speechAbortRef = useRef<AbortController | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);

  const cancelSpeech = useCallback(() => {
    speechGenerationRef.current += 1;
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const unlockAudio = useCallback(() => {
    const pending = pendingAudioRef.current;
    if (!pending) {
      audioUnlockedRef.current = true;
      setNeedsAudioUnlock(false);
      return;
    }
    pendingAudioRef.current = null;
    void pending
      .play()
      .then(() => {
        audioUnlockedRef.current = true;
        setNeedsAudioUnlock(false);
      })
      .catch(() => setNeedsAudioUnlock(true));
  }, []);

  const playFromUrl = useCallback(async (url: string, controller: AbortController) => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.src = url;

    const finished = new Promise<void>((resolve) => {
      const done = () => {
        setSpeaking(false);
        resolve();
      };
      audio.addEventListener("ended", done, { once: true });
      audio.addEventListener("error", done, { once: true });
      controller.signal.addEventListener(
        "abort",
        () => {
          audio.pause();
          done();
        },
        { once: true },
      );
    });

    if (!audioUnlockedRef.current) {
      try {
        await audio.play();
        audioUnlockedRef.current = true;
      } catch {
        pendingAudioRef.current = audio;
        setNeedsAudioUnlock(true);
        setSpeaking(false);
        return;
      }
    } else {
      await audio.play();
    }

    await finished;
  }, []);

  const playBuffered = useCallback(async (response: Response, controller: AbortController) => {
    const url = URL.createObjectURL(await response.blob());
    if (controller.signal.aborted) {
      URL.revokeObjectURL(url);
      return;
    }

    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;

    const finished = new Promise<void>((resolve) => {
      const done = () => {
        setSpeaking(false);
        if (audioUrlRef.current === url) {
          URL.revokeObjectURL(url);
          audioUrlRef.current = null;
        }
        resolve();
      };
      audio.addEventListener("ended", done, { once: true });
      audio.addEventListener("error", done, { once: true });
      controller.signal.addEventListener("abort", () => resolve(), { once: true });
    });

    if (!audioUnlockedRef.current) {
      try {
        await audio.play();
        audioUnlockedRef.current = true;
      } catch {
        pendingAudioRef.current = audio;
        setNeedsAudioUnlock(true);
        setSpeaking(false);
        return;
      }
    } else {
      await audio.play();
    }

    await finished;
  }, []);

  const speakChunk = useCallback(
    async (text: string, generation: number) => {
      if (!text.trim() || generation !== speechGenerationRef.current) return;

      const controller = new AbortController();
      speechAbortRef.current = controller;
      setSpeaking(true);

      if (voiceSettings.provider === "browser") {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          setSpeaking(false);
          return;
        }
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = voiceSettings.speed;
          const voices = window.speechSynthesis.getVoices();
          const preferred =
            voices.find((voice) => /mark/i.test(voice.name)) ||
            voices.find((voice) => voice.lang.startsWith("en"));
          if (preferred) utterance.voice = preferred;
          utterance.onend = () => {
            setSpeaking(false);
            resolve();
          };
          utterance.onerror = () => {
            setSpeaking(false);
            resolve();
          };
          controller.signal.addEventListener("abort", () => {
            window.speechSynthesis.cancel();
            setSpeaking(false);
            resolve();
          });
          window.speechSynthesis.speak(utterance);
        });
        return;
      }

      const params = new URLSearchParams({
        text,
        voice: voiceSettings.voice,
        speed: String(voiceSettings.speed),
      });
      const streamable = text.length <= MAX_STREAMABLE_SPEECH_LENGTH;
      const response = await fetch(
        streamable ? `/api/mason/speech?${params}` : "/api/mason/speech",
        streamable
          ? { signal: controller.signal }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text,
                voice: voiceSettings.voice,
                speed: voiceSettings.speed,
              }),
              signal: controller.signal,
            },
      );
      if (!response.ok || generation !== speechGenerationRef.current) {
        setSpeaking(false);
        return;
      }
      if (streamable) await playFromUrl(`/api/mason/speech?${params}`, controller);
      else await playBuffered(response, controller);
    },
    [playBuffered, playFromUrl, voiceSettings],
  );

  const speak = useCallback(
    (text: string) => {
      if (!voiceSettings.enabled || !text.trim()) return Promise.resolve();
      const generation = speechGenerationRef.current;
      speakQueueRef.current = speakQueueRef.current
        .then(async () => {
          for (const chunk of speechChunks(text)) {
            if (generation !== speechGenerationRef.current) break;
            await speakChunk(chunk, generation);
          }
        })
        .catch(() => undefined);
      return speakQueueRef.current;
    },
    [speakChunk, voiceSettings.enabled],
  );

  return {
    speak,
    cancelSpeech,
    unlockAudio,
    speaking,
    needsAudioUnlock,
  };
}
