"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PresentationView,
  PublicClassroomCourse,
} from "@/lib/classroom";
import { defaultClassroomBuilderConfig } from "@/lib/classroom-builder";
import {
  beatIndexForSlide,
  buildLessonBeats,
  navLabelForBeat,
  presentationForBeat,
} from "@/lib/classroom-lesson";
import { speechChunks } from "@/lib/classroom-teacher";
import ClassroomTopBar from "@/components/classroom/ClassroomTopBar";
import PresentationArea from "@/components/classroom/PresentationArea";
import TeacherChat, { type TeacherMessage } from "@/components/classroom/TeacherChat";

type ChatApiResponse = {
  reply?: string;
  presentation?: PresentationView;
  quickReplies?: string[];
  expectsResponse?: boolean;
  error?: string;
};

export default function ClassroomShell({
  course,
}: {
  course: PublicClassroomCourse;
}) {
  const plan = course.plan;
  const builderConfig = plan.config;
  const voiceSettings = useMemo(() => {
    const defaults = defaultClassroomBuilderConfig().teaching;
    const settings = defaultClassroomBuilderConfig().settings;
    return {
      voice: builderConfig?.teaching.voice ?? defaults.voice,
      speed: builderConfig?.teaching.voiceSpeed ?? defaults.voiceSpeed,
      enabled: builderConfig?.settings.speechVoice ?? settings.speechVoice,
    };
  }, [builderConfig]);

  const lessonBeats = useMemo(
    () => plan.lessonBeats || buildLessonBeats(plan),
    [plan],
  );

  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [paused, setPaused] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [, setTaughtSlideIndices] = useState<number[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [assessmentQuestionIndex, setAssessmentQuestionIndex] = useState(0);
  const [expectsResponse, setExpectsResponse] = useState(false);
  const [presentation, setPresentation] = useState<PresentationView>({
    type: "welcome",
    headline: plan.title,
    body: plan.opening,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakQueueRef = useRef<Promise<void>>(Promise.resolve());
  const chatAbortRef = useRef<AbortController | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const turnRequestIdRef = useRef(0);

  function markSlideTaught(slideIndex: number) {
    setTaughtSlideIndices((current) =>
      current.includes(slideIndex) ? current : [...current, slideIndex],
    );
  }

  const unlockAudio = useCallback(() => {
    audioUnlockedRef.current = true;
    const pending = pendingAudioRef.current;
    if (pending) {
      pendingAudioRef.current = null;
      setNeedsAudioUnlock(false);
      setSpeaking(true);
      void pending.play().catch(() => {
        setSpeaking(false);
        setNeedsAudioUnlock(true);
        pendingAudioRef.current = pending;
      });
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void beginClass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
      speechAbortRef.current?.abort();
      audioRef.current?.pause();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  function cancelSpeech() {
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
  }

  function toggleBreak() {
    setPaused((current) => {
      if (!current) cancelSpeech();
      return !current;
    });
  }

  async function speak(text: string) {
    if (!voiceSettings.enabled || !text.trim()) return;

    const run = async () => {
      speechAbortRef.current?.abort();
      audioRef.current?.pause();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      const controller = new AbortController();
      speechAbortRef.current = controller;

      setSpeaking(true);
      try {
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
        if (!response.ok) throw new Error("speech failed");

        const url = URL.createObjectURL(await response.blob());
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }

        window.speechSynthesis.cancel();
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setSpeaking(false);
          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            audioUrlRef.current = null;
          }
        };

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
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSpeaking(false);
      }
    };

    speakQueueRef.current = speakQueueRef.current.then(run).catch(() => undefined);
    await speakQueueRef.current;
  }

  function speakNatural(text: string) {
    const chunks = speechChunks(text);
    for (const chunk of chunks) {
      void speak(chunk);
    }
  }

  function applyTeacherPresentation(view: PresentationView) {
    setPresentation(view);
    if (view.type === "slide") {
      setCurrentSlideIndex(view.slideIndex);
      markSlideTaught(view.slideIndex);
      const nextBeat = beatIndexForSlide(lessonBeats, view.slideIndex);
      if (nextBeat >= 0) setBeatIndex(nextBeat);
    }
    if (
      view.type === "assessment" &&
      typeof view.questionIndex === "number"
    ) {
      setAssessmentQuestionIndex(view.questionIndex);
      const assessmentBeat = lessonBeats.findIndex((beat) => beat.kind === "assessment");
      if (assessmentBeat >= 0) setBeatIndex(assessmentBeat);
    }
    if (view.type === "flashcard" || view.type === "dragdrop") {
      setQuickReplies([]);
    }
  }

  async function sendToTeacher(
    nextMessages: TeacherMessage[],
    options?: {
      presentation?: PresentationView;
      slideIndex?: number;
      beatIndex?: number;
    },
  ) {
    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;
    const requestId = ++turnRequestIdRef.current;

    setThinking(true);
    try {
      const response = await fetch("/api/classroom/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: course.slug,
          slideIndex: options?.slideIndex ?? currentSlideIndex,
          beatIndex: options?.beatIndex ?? beatIndex,
          assessmentQuestionIndex,
          presentation: options?.presentation ?? presentation,
          messages: nextMessages,
        }),
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestId !== turnRequestIdRef.current) {
        return;
      }

      const data = (await response.json()) as ChatApiResponse;
      const reply =
        data.reply ||
        data.error ||
        "Let's keep going. Tell me what you're thinking so far.";

      if (requestId !== turnRequestIdRef.current) return;

      setThinking(false);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      if (data.presentation) {
        applyTeacherPresentation(data.presentation);
      }
      if (data.quickReplies?.length) {
        setQuickReplies(data.quickReplies);
      } else {
        setQuickReplies([]);
      }
      const needsResponse =
        data.expectsResponse ??
        (data.presentation?.type === "question" ||
          data.presentation?.type === "exercise" ||
          data.presentation?.type === "assessment");
      setExpectsResponse(Boolean(needsResponse));
      speakNatural(reply);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message =
        error instanceof Error ? error.message : "The instructor could not respond.";
      if (requestId !== turnRequestIdRef.current) return;
      setMessages([
        ...nextMessages,
        { role: "assistant", content: message },
      ]);
    } finally {
      if (chatAbortRef.current === controller) {
        setThinking(false);
      }
    }
  }

  async function beginClass() {
    const welcomeView: PresentationView = {
      type: "welcome",
      headline: plan.title,
      body: plan.opening,
    };
    setPresentation(welcomeView);
    setQuickReplies([]);
    setExpectsResponse(true);

    const bootstrap: TeacherMessage[] = [
      {
        role: "user",
        content:
          "Begin the lesson. Welcome me briefly, then ask what I already know about this topic. Stay on the welcome screen until I respond.",
      },
    ];
    await sendToTeacher(bootstrap, { presentation: welcomeView });
  }

  async function handleSend(message: string) {
    unlockAudio();
    const next: TeacherMessage[] = [...messages, { role: "user", content: message }];
    setMessages(next);
    await sendToTeacher(next);
  }

  async function handleActivityComplete() {
    unlockAudio();
    const next: TeacherMessage[] = [
      ...messages,
      { role: "user", content: "I finished the practice activity." },
    ];
    setMessages(next);
    await sendToTeacher(next);
  }

  async function handleSelectBeat(nextBeatIndex: number) {
    const beat = lessonBeats[nextBeatIndex];
    if (!beat || nextBeatIndex === beatIndex) return;

    unlockAudio();
    cancelSpeech();

    const view = presentationForBeat(plan, beat, assessmentQuestionIndex);
    const nextSlideIndex =
      beat.kind === "slide"
        ? beat.slideIndex
        : view.type === "slide"
          ? view.slideIndex
          : currentSlideIndex;

    setBeatIndex(nextBeatIndex);
    setPresentation(view);
    if (beat.kind === "slide") {
      setCurrentSlideIndex(beat.slideIndex);
      markSlideTaught(beat.slideIndex);
    }
    setQuickReplies([]);

    const label = navLabelForBeat(beat, plan);
    const next: TeacherMessage[] = [
      ...messages,
      { role: "user", content: `Let's go to "${label}" — continue teaching from there.` },
    ];
    setMessages(next);
    await sendToTeacher(next, {
      presentation: view,
      slideIndex: nextSlideIndex,
      beatIndex: nextBeatIndex,
    });
  }

  const awaitingInput =
    !paused &&
    !thinking &&
    !speaking &&
    (expectsResponse ||
      presentation.type === "question" ||
      presentation.type === "exercise" ||
      presentation.type === "assessment");
  const inputPrompt =
    presentation.type === "question" ||
    presentation.type === "exercise" ||
    presentation.type === "assessment"
      ? presentation.prompt
      : undefined;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-white text-slate-900">
      <ClassroomTopBar
        plan={plan}
        lessonBeats={lessonBeats}
        activeBeatIndex={beatIndex}
        onSelectBeat={(index) => void handleSelectBeat(index)}
        paused={paused}
        onToggleBreak={toggleBreak}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
        <PresentationArea
          plan={plan}
          view={presentation}
          activeSlideIndex={currentSlideIndex}
          onToggleBreak={toggleBreak}
          paused={paused}
          onActivityComplete={() => void handleActivityComplete()}
        />

        <TeacherChat
          messages={messages}
          quickReplies={quickReplies}
          thinking={thinking}
          speaking={speaking}
          needsAudioUnlock={needsAudioUnlock}
          speechToTextEnabled={builderConfig?.settings.speechText ?? true}
          awaitingInput={awaitingInput}
          inputPrompt={inputPrompt}
          onSend={handleSend}
          onSpeak={speak}
          onInteract={unlockAudio}
        />
      </div>
    </main>
  );
}
