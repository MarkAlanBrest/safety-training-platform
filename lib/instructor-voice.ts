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

export type InstructorSpeechOptions = {
  /** Receives the portion of the sentence that has been spoken so far. */
  onProgress?: (spokenText: string, complete: boolean) => void;
};

function textAtProgress(text: string, progress: number) {
  if (progress >= 1) return text;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const count = Math.max(1, Math.min(words.length, Math.ceil(words.length * progress)));
  return words.slice(0, count).join(" ");
}

export function useInstructorVoice(voiceSettings: InstructorVoiceSettings) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakQueueRef = useRef<Promise<void>>(Promise.resolve());
  const speechGenerationRef = useRef(0);
  const speechAbortRef = useRef<AbortController | null>(null);
  const browserVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
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

  const getBrowserVoice = useCallback(async (signal: AbortSignal) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;

    const synth = window.speechSynthesis;
    let voices = synth.getVoices();

    // Chromium can return no voices at first. Speaking immediately makes the
    // opening chunk use a temporary default voice and later chunks switch.
    if (!voices.length && !signal.aborted) {
      await new Promise<void>((resolve) => {
        let timer = 0;
        const finish = () => {
          synth.removeEventListener("voiceschanged", finish);
          signal.removeEventListener("abort", finish);
          window.clearTimeout(timer);
          resolve();
        };
        synth.addEventListener("voiceschanged", finish);
        signal.addEventListener("abort", finish, { once: true });
        timer = window.setTimeout(finish, 1200);
      });
      voices = synth.getVoices();
    }

    if (signal.aborted) return null;
    const cached = browserVoiceRef.current;
    if (cached) {
      const current = voices.find((voice) => voice.voiceURI === cached.voiceURI);
      if (current) return current;
    }

    const configured = voiceSettings.voice.trim().toLowerCase();
    const preferred =
      voices.find((voice) => voice.name.toLowerCase() === configured || voice.voiceURI.toLowerCase() === configured) ||
      voices.find((voice) => /mark/i.test(voice.name)) ||
      voices.find((voice) => /^en(?:-|_)/i.test(voice.lang)) ||
      voices[0] ||
      null;
    browserVoiceRef.current = preferred;
    return preferred;
  }, [voiceSettings.voice]);

  const playFromUrl = useCallback(async (
    url: string,
    controller: AbortController,
    text: string,
    onProgress?: InstructorSpeechOptions["onProgress"],
  ) => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.src = url;
    const updateCaption = () => {
      if (!onProgress) return;
      const duration = audio.duration;
      const progress = Number.isFinite(duration) && duration > 0
        ? Math.min(1, audio.currentTime / duration)
        : 0.03;
      onProgress(textAtProgress(text, progress), progress >= 1);
    };
    audio.addEventListener("playing", updateCaption);
    audio.addEventListener("timeupdate", updateCaption);

    const finished = new Promise<void>((resolve) => {
      const done = () => {
        onProgress?.(text, true);
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

  const playBuffered = useCallback(async (
    response: Response,
    controller: AbortController,
    text: string,
    onProgress?: InstructorSpeechOptions["onProgress"],
  ) => {
    const url = URL.createObjectURL(await response.blob());
    if (controller.signal.aborted) {
      URL.revokeObjectURL(url);
      return;
    }

    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    const updateCaption = () => {
      if (!onProgress) return;
      const progress = Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.min(1, audio.currentTime / audio.duration)
        : 0.03;
      onProgress(textAtProgress(text, progress), progress >= 1);
    };
    audio.addEventListener("playing", updateCaption);
    audio.addEventListener("timeupdate", updateCaption);

    const finished = new Promise<void>((resolve) => {
      const done = () => {
        onProgress?.(text, true);
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
    async (
      text: string,
      generation: number,
      onProgress?: InstructorSpeechOptions["onProgress"],
    ) => {
      if (!text.trim() || generation !== speechGenerationRef.current) return;

      const controller = new AbortController();
      speechAbortRef.current = controller;
      setSpeaking(true);

      if (voiceSettings.provider === "browser") {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          setSpeaking(false);
          return;
        }
        const browserVoice = await getBrowserVoice(controller.signal);
        if (controller.signal.aborted || generation !== speechGenerationRef.current) {
          setSpeaking(false);
          return;
        }
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = voiceSettings.speed;
          if (browserVoice) utterance.voice = browserVoice;
          utterance.onstart = () => onProgress?.(textAtProgress(text, 0.03), false);
          utterance.onboundary = (event) => {
            const end = Math.max(1, event.charIndex + (event.charLength || 0));
            onProgress?.(text.slice(0, end).trimEnd(), false);
          };
          utterance.onend = () => {
            onProgress?.(text, true);
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
      if (streamable) {
        // Let the audio element stream the GET directly. Fetching it first caused
        // every premium narration clip to be downloaded twice.
        await playFromUrl(`/api/mason/speech?${params}`, controller, text, onProgress);
      } else {
        const response = await fetch("/api/mason/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voice: voiceSettings.voice,
            speed: voiceSettings.speed,
          }),
          signal: controller.signal,
        });
        if (!response.ok || generation !== speechGenerationRef.current) {
          setSpeaking(false);
          return;
        }
        await playBuffered(response, controller, text, onProgress);
      }
    },
    [getBrowserVoice, playBuffered, playFromUrl, voiceSettings],
  );

  const speak = useCallback(
    (text: string, options?: InstructorSpeechOptions) => {
      if (!text.trim()) return Promise.resolve();
      if (!voiceSettings.enabled) {
        options?.onProgress?.(text, true);
        return Promise.resolve();
      }
      const generation = speechGenerationRef.current;
      speakQueueRef.current = speakQueueRef.current
        .then(async () => {
          let completed = "";
          for (const chunk of speechChunks(text)) {
            if (generation !== speechGenerationRef.current) break;
            await speakChunk(chunk, generation, (partial, complete) => {
              const visible = [completed, partial].filter(Boolean).join(" ").trim();
              options?.onProgress?.(visible, complete && visible === text.trim());
            });
            completed = [completed, chunk].filter(Boolean).join(" ").trim();
          }
          if (generation === speechGenerationRef.current) {
            options?.onProgress?.(text, true);
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
