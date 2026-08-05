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
  lastAnswerCorrect?: boolean | null;
  error?: string;
};

type AnswerStreak = { correctInRow: number; incorrectInRow: number };

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
  const [taughtSlideIndices, setTaughtSlideIndices] = useState<number[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [assessmentQuestionIndex, setAssessmentQuestionIndex] = useState(0);
  const [expectsResponse, setExpectsResponse] = useState(false);
  const [checkQuestion, setCheckQuestion] = useState<ClassroomCheckQuestion | null>(null);
  const [finalTestCompleted, setFinalTestCompleted] = useState(false);
  const [classStarted, setClassStarted] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [studentName, setStudentName] = useState("");
  const [streak, setStreak] = useState<AnswerStreak>({ correctInRow: 0, incorrectInRow: 0 });
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

  function handleStartClass() {
    if (startedRef.current) return;
    startedRef.current = true;
    setStudentName(nameDraft.trim());
    setClassStarted(true);
    unlockAudio();
    void beginClass();
  }

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

  /**
   * Downloads then plays the whole clip. Simple and reliable — an earlier attempt at
   * progressive MediaSource streaming here could hang indefinitely (no timeout on
   * `sourceopen`) and freeze the whole class, since a stuck `speaking` state blocks
   * auto-advance forever. TTS caching on the server keeps this fast in practice since
   * most requests now hit a cached clip instead of waiting on live synthesis.
   */
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

        // Hard safety net: never let a stuck audio element freeze the class — a stuck
        // `speaking` state blocks auto-advance forever. If playback genuinely hasn't
        // finished in 45s (a normal clip takes a few seconds), give up on it.
        await Promise.race([
          playBuffered(response, controller),
          new Promise<void>((resolve) => setTimeout(resolve, 45_000)),
        ]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSpeaking(false);
      } finally {
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
          studentName,
          taughtSlideIndices,
          streak,
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
      if (typeof data.lastAnswerCorrect === "boolean") {
        setStreak((current) =>
          data.lastAnswerCorrect
            ? { correctInRow: current.correctInRow + 1, incorrectInRow: 0 }
            : { correctInRow: 0, incorrectInRow: current.incorrectInRow + 1 },
        );
      }
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

  if (!classStarted) {
    return (
      <main className="flex h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0f2b46] to-[#163a5d] px-6 text-white">
        <div className="w-full max-w-md rounded-3xl bg-white/10 p-8 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-200">
            {plan.title}
          </p>
          <h2 className="mt-3 text-2xl font-bold">Before we begin — what&apos;s your name?</h2>
          <p className="mt-2 text-sm text-slate-200">
            So your instructor can address you directly during class. Optional — you can
            leave this blank.
          </p>
          <input
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleStartClass();
            }}
            placeholder="Your first name"
            className="mt-6 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={handleStartClass}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-[#10283f]"
          >
            Start class
          </button>
        </div>
      </main>
    );
  }

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
