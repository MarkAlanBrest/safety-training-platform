"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ClassroomCheckQuestion, PublicClassroomCourse } from "@/lib/classroom";
import { defaultClassroomBuilderConfig } from "@/lib/classroom-builder";
import { filterPrivateSpeechDirections } from "@/lib/classroom-speech";
import { markerToCheckQuestion } from "@/lib/classroom-video";
import type { VideoTimelineMarker } from "@/lib/classroom-video";
import TeacherChat, { type TeacherMessage } from "@/components/classroom/TeacherChat";
import VideoClassroomPlayer, {
  type VideoClassroomPlayerHandle,
} from "@/components/classroom/VideoClassroomPlayer";
import VideoClassroomTopBar from "@/components/classroom/VideoClassroomTopBar";

const MAX_STREAMABLE_SPEECH_LENGTH = 1500;

type ChatApiResponse = {
  reply?: string;
  expectsResponse?: boolean;
  checkQuestion?: ClassroomCheckQuestion | null;
  lastAnswerCorrect?: boolean | null;
  error?: string;
};

export default function VideoClassroomShell({
  course,
}: {
  course: PublicClassroomCourse;
}) {
  const videoCourse = course.plan.videoCourse;
  const builderConfig = course.plan.config || defaultClassroomBuilderConfig();
  const voiceSettings = useMemo(
    () => ({
      enabled: builderConfig.settings.speechVoice,
      provider: builderConfig.teaching.voiceProvider,
      voice: builderConfig.teaching.voice,
      speed: builderConfig.teaching.voiceSpeed,
    }),
    [builderConfig],
  );

  const playerRef = useRef<VideoClassroomPlayerHandle>(null);
  const startedRef = useRef(false);
  const welcomedRef = useRef(false);
  const videoMutedForSpeechRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakQueueRef = useRef<Promise<void>>(Promise.resolve());
  const speechGenerationRef = useRef(0);
  const speechAbortRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [checkQuestion, setCheckQuestion] = useState<ClassroomCheckQuestion | null>(null);
  const [expectsResponse, setExpectsResponse] = useState(false);
  const [overlayPrompt, setOverlayPrompt] = useState<string | null>(null);
  const [activeMarker, setActiveMarker] = useState<VideoTimelineMarker | null>(null);
  const [awaitingMarkerResume, setAwaitingMarkerResume] = useState(false);
  const [chatError, setChatError] = useState("");
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playback, setPlayback] = useState({ currentTime: 0, duration: 0 });
  const [playbackError, setPlaybackError] = useState("");

  const unlockAudio = useCallback(() => {
    audioUnlockedRef.current = true;
    const pending = pendingAudioRef.current;
    if (!pending) return;
    pendingAudioRef.current = null;
    setNeedsAudioUnlock(false);
    setSpeaking(true);
    void pending.play().catch(() => {
      setSpeaking(false);
      setNeedsAudioUnlock(true);
      pendingAudioRef.current = pending;
    });
  }, []);

  const muteVideoForSpeech = useCallback(() => {
    videoMutedForSpeechRef.current = playerRef.current?.isMuted() ?? false;
    playerRef.current?.setMuted(true);
  }, []);

  const restoreVideoMute = useCallback(() => {
    playerRef.current?.setMuted(videoMutedForSpeechRef.current);
  }, []);

  const cancelSpeech = useCallback(() => {
    speechGenerationRef.current += 1;
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    window.speechSynthesis.cancel();
    audioRef.current?.pause();
    pendingAudioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setSpeaking(false);
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

  const speakWithBrowserVoice = useCallback(
    async (text: string, controller: AbortController) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      const synth = window.speechSynthesis;
      let voices = synth.getVoices();
      if (!voices.length) {
        await new Promise<void>((resolve) => {
          const finish = () => resolve();
          synth.addEventListener("voiceschanged", finish, { once: true });
          controller.signal.addEventListener("abort", finish, { once: true });
          window.setTimeout(finish, 1_000);
        });
        voices = synth.getVoices();
      }

      if (controller.signal.aborted) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.min(2, Math.max(0.5, voiceSettings.speed || 1));
      const markVoice = voices.find((voice) => /\bmark\b/i.test(voice.name));
      const preferredVoice =
        markVoice || voices.find((voice) => voice.lang?.startsWith("en")) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;

      await new Promise<void>((resolve) => {
        const done = () => {
          setSpeaking(false);
          resolve();
        };
        utterance.onend = done;
        utterance.onerror = done;
        controller.signal.addEventListener(
          "abort",
          () => {
            synth.cancel();
            done();
          },
          { once: true },
        );
        synth.speak(utterance);
      });
    },
    [voiceSettings.speed],
  );

  const speak = useCallback(
    async (text: string) => {
      const narration = filterPrivateSpeechDirections(text);
      if (!voiceSettings.enabled || !narration.trim()) return;

      const generation = ++speechGenerationRef.current;
      speechAbortRef.current?.abort();
      audioRef.current?.pause();
      window.speechSynthesis.cancel();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      const run = async () => {
        if (generation !== speechGenerationRef.current) return;

        muteVideoForSpeech();
        const controller = new AbortController();
        speechAbortRef.current = controller;
        setSpeaking(true);

        const safetyTimeout = new Promise<void>((resolve) => setTimeout(resolve, 45_000));

        try {
          if (voiceSettings.provider === "browser") {
            await Promise.race([speakWithBrowserVoice(narration, controller), safetyTimeout]);
          } else if (narration.length <= MAX_STREAMABLE_SPEECH_LENGTH) {
            const url = `/api/mason/speech?${new URLSearchParams({
              text: narration,
              voice: voiceSettings.voice,
              speed: String(voiceSettings.speed),
            }).toString()}`;
            await Promise.race([playFromUrl(url, controller), safetyTimeout]);
          } else {
            const response = await fetch("/api/mason/speech", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: narration,
                voice: voiceSettings.voice,
                speed: voiceSettings.speed,
              }),
              signal: controller.signal,
            });
            if (!response.ok) throw new Error("speech failed");
            await Promise.race([playBuffered(response, controller), safetyTimeout]);
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        } finally {
          restoreVideoMute();
          if (generation === speechGenerationRef.current) setSpeaking(false);
        }
      };

      speakQueueRef.current = speakQueueRef.current.then(run).catch(() => undefined);
      await speakQueueRef.current;
    },
    [
      muteVideoForSpeech,
      playBuffered,
      playFromUrl,
      restoreVideoMute,
      speakWithBrowserVoice,
      voiceSettings.enabled,
      voiceSettings.provider,
      voiceSettings.speed,
      voiceSettings.voice,
    ],
  );

  const resumePlayback = useCallback(async () => {
    setCheckQuestion(null);
    setExpectsResponse(false);
    setOverlayPrompt(null);
    setActiveMarker(null);
    setAwaitingMarkerResume(false);
    restoreVideoMute();
    await playerRef.current?.play();
  }, [restoreVideoMute]);

  const sendToTeacher = useCallback(
    async (nextMessages: TeacherMessage[], options?: { speakReply?: boolean }) => {
      setThinking(true);
      setChatError("");
      try {
        const response = await fetch("/api/classroom/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseSlug: course.slug,
            videoTimeSeconds: playerRef.current?.getCurrentTime() ?? 0,
            activeMarkerId: activeMarker?.id,
            messages: nextMessages,
            includeImage: false,
            presentation: { type: "welcome", headline: course.title, body: "" },
          }),
        });

        let data: ChatApiResponse;
        try {
          data = (await response.json()) as ChatApiResponse;
        } catch {
          throw new Error("The instructor could not respond. Please try again.");
        }

        if (!response.ok) {
          throw new Error(data.error || "The instructor could not respond. Please try again.");
        }

        const reply =
          data.reply?.trim() ||
          "I'm here if you have questions about this part of the lesson.";
        setMessages([...nextMessages, { role: "assistant", content: reply }]);
        setExpectsResponse(Boolean(data.expectsResponse));
        setCheckQuestion(data.checkQuestion || null);
        if (options?.speakReply !== false && reply.trim()) {
          await speak(reply);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The instructor could not respond. Please try again.";
        setChatError(message);
      } finally {
        setThinking(false);
      }
    },
    [activeMarker?.id, course.slug, course.title, speak],
  );

  const handleMarkerReached = useCallback(
    async (marker: VideoTimelineMarker) => {
      cancelSpeech();
      playerRef.current?.pause();
      setActiveMarker(marker);

      if (marker.kind === "continue") {
        window.setTimeout(() => resumePlayback(), 400);
        return;
      }

      if (marker.kind === "ai_say") {
        const script = marker.aiScript?.trim() || marker.label?.trim() || "";
        if (script) {
          setOverlayPrompt(script);
          setMessages((current) => [...current, { role: "assistant", content: script }]);
          await speak(script);
        }
        resumePlayback();
        return;
      }

      const question = markerToCheckQuestion(marker);
      if (question) {
        setCheckQuestion(question);
        setExpectsResponse(true);
        setAwaitingMarkerResume(true);
        if (marker.aiScript?.trim()) {
          setOverlayPrompt(marker.aiScript.trim());
          await speak(marker.aiScript.trim());
        }
        return;
      }

      resumePlayback();
    },
    [cancelSpeech, resumePlayback, speak],
  );

  const handleSend = useCallback(
    async (message: string) => {
      unlockAudio();
      const next: TeacherMessage[] = [...messages, { role: "user", content: message }];
      setMessages(next);

      if (checkQuestion && activeMarker?.correctAnswer) {
        const normalized = message.trim().toLowerCase();
        const key = activeMarker.correctAnswer.trim().toLowerCase();
        const correct =
          activeMarker.questionType === "trueFalse"
            ? normalized === key || normalized === (key === "true" ? "t" : "f")
            : normalized === key ||
              activeMarker.options?.some(
                (option, index) =>
                  option.toLowerCase() === normalized &&
                  (key === option.toLowerCase() || key === String(index + 1)),
              );

        const feedback = correct
          ? "That's right — let's keep going."
          : `Not quite. The key point is: ${activeMarker.correctAnswer}. Let's continue.`;
        setMessages([...next, { role: "assistant", content: feedback }]);
        await speak(feedback);
        resumePlayback();
        return;
      }

      await sendToTeacher(next);
    },
    [
      activeMarker,
      checkQuestion,
      messages,
      resumePlayback,
      sendToTeacher,
      speak,
      unlockAudio,
    ],
  );

  const sendWelcome = useCallback(() => {
    if (welcomedRef.current) return;
    welcomedRef.current = true;
    void sendToTeacher(
      [
        {
          role: "user",
          hidden: true,
          content:
            "The student just started this video course. Give a one-sentence welcome and tell them they can ask questions in the instructor panel anytime.",
        },
      ],
      { speakReply: false },
    );
  }, [sendToTeacher]);

  const beginClass = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    setPlaybackError("");
    playerRef.current?.resetMarkers();
    unlockAudio();
    sendWelcome();
    await playerRef.current?.play();
  }, [sendWelcome, unlockAudio]);

  const awaitingInput =
    !thinking && !speaking && (expectsResponse || Boolean(checkQuestion));

  const toggleBreak = useCallback(() => {
    setPaused((current) => {
      if (!current) {
        cancelSpeech();
        playerRef.current?.pause();
      } else {
        void playerRef.current?.play();
      }
      return !current;
    });
  }, [cancelSpeech]);

  if (!videoCourse?.videoUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 px-8 text-center text-white">
        <p>This video course is missing its media file.</p>
      </div>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-white text-slate-900">
      <VideoClassroomTopBar
        title={course.title}
        currentTime={playback.currentTime}
        duration={playback.duration}
        paused={paused}
        onToggleBreak={toggleBreak}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-0 bg-black">
          <VideoClassroomPlayer
            ref={playerRef}
            videoUrl={videoCourse.videoUrl}
            captionsUrl={videoCourse.captionsUrl}
            markers={videoCourse.markers}
            markersActive={started}
            onMarkerReached={(marker) => void handleMarkerReached(marker)}
            onPlaybackUpdate={setPlayback}
            onPlaybackError={setPlaybackError}
            pausedExternally={paused || awaitingMarkerResume}
          />

          {playbackError ? (
            <div className="absolute inset-x-0 top-4 z-20 flex justify-center px-4">
              <p className="rounded-xl bg-red-600/90 px-4 py-2 text-sm font-semibold text-white">
                {playbackError}
              </p>
            </div>
          ) : null}

          {overlayPrompt ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
              <div className="max-w-2xl rounded-2xl bg-slate-950/85 px-5 py-4 text-center text-sm leading-6 text-white backdrop-blur">
                {overlayPrompt}
              </div>
            </div>
          ) : null}

          {!started ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55">
              <button
                type="button"
                onClick={() => void beginClass()}
                className="rounded-full bg-amber-400 px-8 py-4 text-lg font-bold text-slate-950 shadow-xl"
              >
                Start course
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col border-t border-slate-200 lg:border-l lg:border-t-0">
          {chatError ? (
            <p className="shrink-0 border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600">
              {chatError}
            </p>
          ) : null}
          <TeacherChat
            messages={messages}
            thinking={thinking || speaking}
            checkQuestion={checkQuestion}
            onSelectOption={(option) => void handleSend(option)}
            speechToTextEnabled={builderConfig.settings.speechText}
            needsAudioUnlock={needsAudioUnlock}
            awaitingInput={awaitingInput}
            onSend={handleSend}
            onSpeak={speak}
            onInteract={unlockAudio}
          />
        </div>
      </div>
    </main>
  );
}
