"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClassroomCheckQuestion,
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
import ClassroomTopBar from "@/components/classroom/ClassroomTopBar";
import ClassroomFinalTestRunner from "@/components/classroom/ClassroomFinalTestRunner";
import PresentationArea from "@/components/classroom/PresentationArea";
import TeacherChat, { type TeacherMessage } from "@/components/classroom/TeacherChat";

type ChatApiResponse = {
  reply?: string;
  presentation?: PresentationView;
  quickReplies?: string[];
  expectsResponse?: boolean;
  checkQuestion?: ClassroomCheckQuestion | null;
  error?: string;
};

function speechTextForTurn(reply: string, checkQuestion: ClassroomCheckQuestion | null) {
  if (!checkQuestion) return reply;
  const options =
    checkQuestion.options?.length
      ? checkQuestion.options
      : checkQuestion.type === "trueFalse"
        ? ["True", "False"]
        : undefined;
  const optionsText = options?.length
    ? " " + options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join(" ")
    : "";
  return `${reply} ${checkQuestion.prompt}${optionsText}`.trim();
}

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
  const [, setTaughtSlideIndices] = useState<number[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [assessmentQuestionIndex, setAssessmentQuestionIndex] = useState(0);
  const [expectsResponse, setExpectsResponse] = useState(false);
  const [checkQuestion, setCheckQuestion] = useState<ClassroomCheckQuestion | null>(null);
  const [finalTestCompleted, setFinalTestCompleted] = useState(false);
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
  const autoAdvanceCountRef = useRef(0);

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

  function canStreamMp3(): boolean {
    return (
      typeof window !== "undefined" &&
      "MediaSource" in window &&
      typeof MediaSource.isTypeSupported === "function" &&
      MediaSource.isTypeSupported("audio/mpeg")
    );
  }

  /**
   * Plays audio as bytes arrive instead of waiting for the whole clip to download —
   * cuts the time before the student hears anything. Falls back to the old
   * download-then-play approach if MediaSource streaming isn't available/fails.
   */
  async function playStreamed(
    body: ReadableStream<Uint8Array>,
    controller: AbortController,
  ): Promise<void> {
    const mediaSource = new MediaSource();
    const audio = new Audio();
    audioRef.current = audio;
    const objectUrl = URL.createObjectURL(mediaSource);
    audioUrlRef.current = objectUrl;
    audio.src = objectUrl;

    const finished = new Promise<void>((resolve) => {
      const done = () => {
        setSpeaking(false);
        if (audioUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          audioUrlRef.current = null;
        }
        resolve();
      };
      audio.addEventListener("ended", done, { once: true });
      audio.addEventListener("error", done, { once: true });
      controller.signal.addEventListener("abort", () => done(), { once: true });
    });

    await new Promise<void>((resolveOpen, rejectOpen) => {
      mediaSource.addEventListener("sourceopen", () => resolveOpen(), { once: true });
      mediaSource.addEventListener("error", () => rejectOpen(new Error("MediaSource failed to open")), {
        once: true,
      });
    });
    const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");

    if (!audioUnlockedRef.current) {
      try {
        await audio.play();
        audioUnlockedRef.current = true;
      } catch {
        pendingAudioRef.current = audio;
        setNeedsAudioUnlock(true);
        setSpeaking(false);
        controller.abort();
        return;
      }
    } else {
      void audio.play();
    }

    const reader = body.getReader();
    try {
      while (true) {
        const { done: readDone, value } = await reader.read();
        if (controller.signal.aborted) break;
        if (readDone) {
          if (mediaSource.readyState === "open") mediaSource.endOfStream();
          break;
        }
        if (sourceBuffer.updating) {
          await new Promise<void>((res) => sourceBuffer.addEventListener("updateend", () => res(), { once: true }));
        }
        // .slice() copies into a plain (non-shared) ArrayBuffer, matching appendBuffer's stricter BufferSource type.
        sourceBuffer.appendBuffer(value.slice());
      }
    } catch {
      // Streaming failed mid-flight — signal end-of-stream so playback of whatever
      // already buffered can finish naturally instead of hanging forever waiting
      // for data that will never arrive.
      try {
        if (mediaSource.readyState === "open") mediaSource.endOfStream();
      } catch {
        // Ignore — nothing more we can do if the media source itself is unusable.
      }
    } finally {
      reader.releaseLock();
    }

    await finished;
  }

  async function playBuffered(response: Response, controller: AbortController): Promise<void> {
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

        window.speechSynthesis.cancel();

        const streamCapable = Boolean(response.body) && canStreamMp3();
        // Clone before either path touches the body — a Response can only be cloned
        // while its body is still untouched.
        const fallbackResponse = streamCapable ? response.clone() : response;

        if (streamCapable) {
          try {
            await playStreamed(response.body!, controller);
            return;
          } catch {
            // Fall through to the buffered path below on any streaming failure.
          }
        }

        await playBuffered(fallbackResponse, controller);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSpeaking(false);
      }
    };

    speakQueueRef.current = speakQueueRef.current.then(run).catch(() => undefined);
    await speakQueueRef.current;
  }

  function speakNatural(text: string) {
    // Speak the whole reply as one clip so nothing gets cut off — chunked
    // playback dropped parts of the narration when autoplay was blocked.
    void speak(text);
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
  }

  async function sendToTeacher(
    nextMessages: TeacherMessage[],
    options?: {
      presentation?: PresentationView;
      slideIndex?: number;
      beatIndex?: number;
      /**
       * Skip re-fetching/re-sending the slide image for this turn. The image is only
       * needed when a new slide is being introduced — replying to a question, grading
       * an answer, or giving feedback on the slide already on screen doesn't need it,
       * and skipping it noticeably cuts response latency since it avoids an extra
       * server-side image fetch + base64 encode + larger vision-model request.
       */
      includeImage?: boolean;
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
          includeImage: options?.includeImage ?? true,
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
      const nextCheckQuestion = data.checkQuestion || null;
      setCheckQuestion(nextCheckQuestion);
      const needsResponse =
        data.expectsResponse ??
        (data.presentation?.type === "question" ||
          data.presentation?.type === "exercise" ||
          data.presentation?.type === "assessment");
      setExpectsResponse(Boolean(needsResponse));
      speakNatural(speechTextForTurn(reply, nextCheckQuestion));
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
    setExpectsResponse(false);

    // Read exactly what is presented on the welcome screen — no AI improvisation.
    const welcomeText = plan.opening;
    setMessages([{ role: "assistant", content: welcomeText }]);
    speakNatural(welcomeText);
  }

  async function handleContinue() {
    unlockAudio();
    cancelSpeech();
    const next: TeacherMessage[] = [
      ...messages,
      {
        role: "user",
        hidden: true,
        content:
          "Continue the lesson. Move to the next beat in the lineup and teach it. Remember: your reply must teach exactly the slide you place on screen.",
      },
    ];
    setMessages(next);
    await sendToTeacher(next);
  }

  async function handleSend(message: string) {
    unlockAudio();
    const next: TeacherMessage[] = [...messages, { role: "user", content: message }];
    setMessages(next);
    await sendToTeacher(next, { includeImage: false });
  }

  async function handleActivityComplete() {
    unlockAudio();
    const next: TeacherMessage[] = [
      ...messages,
      { role: "user", hidden: true, content: "I finished the practice activity." },
    ];
    setMessages(next);
    await sendToTeacher(next, { includeImage: false });
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
    setCheckQuestion(null);
    if (beat.kind === "slide") {
      setCurrentSlideIndex(beat.slideIndex);
      markSlideTaught(beat.slideIndex);
    }

    // The Final Test is a standalone exam mode, not part of the AI chat loop.
    if (beat.kind === "finalTest") return;

    const label = navLabelForBeat(beat, plan);
    const next: TeacherMessage[] = [
      ...messages,
      {
        role: "user",
        hidden: true,
        content: `Let's go to "${label}" — continue teaching from there.`,
      },
    ];
    setMessages(next);
    await sendToTeacher(next, {
      presentation: view,
      slideIndex: nextSlideIndex,
      beatIndex: nextBeatIndex,
    });
  }

  /**
   * Jumps back to the previous content slide. Skips over checkpoint/activity/finalTest
   * beats — comprehension checks live in chat now, not as their own screen to revisit.
   */
  function previousSlideBeatIndex(fromBeatIndex: number): number {
    for (let index = fromBeatIndex - 1; index >= 0; index -= 1) {
      if (lessonBeats[index]?.kind === "slide" || lessonBeats[index]?.kind === "welcome") {
        return index;
      }
    }
    return -1;
  }

  const canGoBack = previousSlideBeatIndex(beatIndex) >= 0;

  async function handleGoBack() {
    const target = previousSlideBeatIndex(beatIndex);
    if (target < 0) return;
    await handleSelectBeat(target);
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

  const currentBeat = lessonBeats[beatIndex];

  // Auto-pace the class like a teacher advancing slides — no manual Continue
  // click required. Only pauses when the AI is waiting on a student answer,
  // during the Final Test, or once the lineup has run out of beats.
  useEffect(() => {
    if (paused || thinking || speaking || expectsResponse) return;
    if (!messages.length) return;
    if (currentBeat?.kind === "finalTest") return;
    if (beatIndex >= lessonBeats.length - 1) return;
    if (autoAdvanceCountRef.current > 300) return;

    const timer = setTimeout(() => {
      autoAdvanceCountRef.current += 1;
      void handleContinue();
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, thinking, speaking, expectsResponse, beatIndex, messages.length, currentBeat]);

  if (currentBeat?.kind === "finalTest" && plan.finalTest && !finalTestCompleted) {
    return (
      <main className="flex h-screen flex-col overflow-hidden bg-white text-slate-900">
        <ClassroomFinalTestRunner
          courseSlug={course.slug}
          finalTest={plan.finalTest}
          onExit={() => {
            setFinalTestCompleted(true);
            setPresentation({
              type: "welcome",
              headline: "Course complete",
              body: "Great work finishing the final test. You can review any slide from the navigation bar above.",
            });
          }}
        />
      </main>
    );
  }

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
          thinking={thinking}
          checkQuestion={checkQuestion}
          needsAudioUnlock={needsAudioUnlock}
          speechToTextEnabled={builderConfig?.settings.speechText ?? true}
          awaitingInput={awaitingInput}
          inputPrompt={inputPrompt}
          onSend={handleSend}
          onSpeak={speak}
          onInteract={unlockAudio}
          onForward={() => void handleContinue()}
          onBack={() => void handleGoBack()}
          canGoBack={canGoBack}
        />
      </div>
    </main>
  );
}
