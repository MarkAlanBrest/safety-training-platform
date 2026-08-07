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
import PresentationArea from "@/components/classroom/PresentationArea";
import TeacherChat, { type TeacherMessage } from "@/components/classroom/TeacherChat";

/** Text at or under this length is played via a direct <audio src> GET request so the
 * browser can stream/play it progressively. Longer text falls back to POST + full
 * download (rare — replies are kept short by instruction) since it's safer than risking
 * an oversized URL. */
const MAX_STREAMABLE_SPEECH_LENGTH = 1500;

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

/**
 * Speaker notes normally replace the need for vision. Author cues that depend on
 * what is visibly present are the exception: the instructor must see the slide to
 * decide whether the condition is true.
 */
function speakerNotesRequestVisualInspection(notes?: string) {
  if (!notes?.trim()) return false;
  return (
    /\b(?:if|when)\b[\s\S]{0,140}\b(?:graphic|image|picture|photo|diagram|chart|visual|screen|slide)\b[\s\S]{0,180}\bask\b/i.test(
      notes,
    ) ||
    /\bask\b[\s\S]{0,180}\b(?:if|when)\b[\s\S]{0,140}\b(?:graphic|image|picture|photo|diagram|chart|visual|screen|slide)\b/i.test(
      notes,
    )
  );
}

function speechTextForTurn(reply: string, checkQuestion: ClassroomCheckQuestion | null) {
  if (!checkQuestion) return reply;
  const options =
    checkQuestion.options?.length
      ? checkQuestion.options
      : checkQuestion.type === "trueFalse"
        ? ["True", "False"]
        : undefined;
  const optionsText = options?.length
    ? " " +
      options
        .map((option, index) => `Option ${String.fromCharCode(65 + index)}: ${option}.`)
        .join(" ")
    : "";
  // The quick-check card replaces the assistant reply in the chat panel. Speech must
  // mirror what the learner can see there instead of reading hidden slide narration.
  return `${checkQuestion.prompt}${optionsText}`.trim();
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
      provider: builderConfig?.teaching.voiceProvider ?? defaults.voiceProvider,
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
  const speechGenerationRef = useRef(0);

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
  }

  function toggleBreak() {
    setPaused((current) => {
      if (!current) cancelSpeech();
      return !current;
    });
  }

  /**
   * Hands the audio element a real network URL and lets the browser stream/play it
   * progressively on its own — no custom buffering code. This is the normal path.
   * (An earlier attempt at manual MediaSource streaming here could hang indefinitely
   * waiting on a `sourceopen` event that never fired, freezing the whole class — this
   * is simpler and doesn't have that failure mode since it's just native <audio src>.)
   */
  async function playFromUrl(url: string, controller: AbortController): Promise<void> {
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
  }

  /** Fallback for text too long to fit safely in a GET URL — downloads then plays the
   * whole clip. Rare in practice since replies are kept short. */
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

  /** Free, on-device narration via the browser's own speech engine. Prefer Mark when
   * the student's browser exposes it, then fall back to another English voice. */
  async function speakWithBrowserVoice(
    text: string,
    controller: AbortController,
  ): Promise<void> {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const synth = window.speechSynthesis;
    let voices = synth.getVoices();

    // Chromium can initially return an empty list while it loads system voices.
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
  }

  async function speak(text: string) {
    if (!voiceSettings.enabled || !text.trim()) return;

    // Cancel whatever is currently playing (or still queued) IMMEDIATELY, not once
    // this call reaches the front of the queue — otherwise stale audio from a
    // previous turn keeps playing after the visuals (like a Quick Check card) have
    // already moved on, so the student hears narration that no longer matches what's
    // on screen. The generation counter also lets an already-queued, now-stale run()
    // recognize it's been superseded and skip itself instead of playing late.
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

      const controller = new AbortController();
      speechAbortRef.current = controller;

      setSpeaking(true);

      // Hard safety net: never let a stuck audio element freeze the class — a stuck
      // `speaking` state blocks auto-advance forever. If playback genuinely hasn't
      // finished in 45s (a normal clip takes a few seconds), give up on it.
      const safetyTimeout = new Promise<void>((resolve) => setTimeout(resolve, 45_000));

      try {
        if (voiceSettings.provider === "browser") {
          await Promise.race([speakWithBrowserVoice(text, controller), safetyTimeout]);
        } else if (text.length <= MAX_STREAMABLE_SPEECH_LENGTH) {
          const url = `/api/mason/speech?${new URLSearchParams({
            text,
            voice: voiceSettings.voice,
            speed: String(voiceSettings.speed),
          }).toString()}`;
          await Promise.race([playFromUrl(url, controller), safetyTimeout]);
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
          if (!response.ok) throw new Error("speech failed");
          await Promise.race([playBuffered(response, controller), safetyTimeout]);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (generation === speechGenerationRef.current) setSpeaking(false);
      } finally {
        if (generation === speechGenerationRef.current) setSpeaking(false);
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
    const nextBeatIndex = beatIndex + 1;
    if (nextBeatIndex >= lessonBeats.length) return;

    // Put the next visual on screen immediately, then let the instructor prepare its
    // narration. This removes the dead pause where the completed slide used to remain
    // visible throughout the entire AI request.
    await handleSelectBeat(nextBeatIndex);
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
    // Video moments are learner-controlled. Wait until playback finishes before
    // asking the instructor to continue to the next lesson beat.
    if (view.type === "video") return;

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
      // Notes normally provide the grounded script without a slower vision request.
      // Visual author cues are the exception because the AI must inspect the slide
      // before deciding whether to ask the conditional question.
      includeImage:
        beat.kind === "slide" &&
        (!plan.slides[beat.slideIndex]?.speakerNotes?.trim() ||
          speakerNotesRequestVisualInspection(
            plan.slides[beat.slideIndex]?.speakerNotes,
          )),
    });
  }

  const awaitingInput =
    !paused &&
    !thinking &&
    !speaking &&
    (expectsResponse ||
      Boolean(checkQuestion) ||
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
  const finalTestActive =
    currentBeat?.kind === "finalTest" && Boolean(plan.finalTest) && !finalTestCompleted;

  useEffect(() => {
    if (finalTestActive) cancelSpeech();
  }, [finalTestActive]);

  // Auto-pace the class like a teacher advancing slides — no manual Continue
  // click required. Only pauses when the AI is waiting on a student answer,
  // during the Final Test, or once the lineup has run out of beats.
  useEffect(() => {
    // checkQuestion is checked directly (not just expectsResponse) so a live
    // comprehension check always blocks auto-advance even if the AI forgets to set
    // expectsResponse on that turn — the structural signal is more reliable than
    // trusting the model got every flag right.
    if (paused || thinking || speaking || expectsResponse || checkQuestion) return;
    if (!messages.length) return;
    if (currentBeat?.kind === "finalTest") return;
    if (
      presentation.type === "video" ||
      presentation.type === "dragdrop" ||
      presentation.type === "hotspot" ||
      presentation.type === "flashcard"
    ) return;
    if (beatIndex >= lessonBeats.length - 1) return;
    if (autoAdvanceCountRef.current > 300) return;

    const timer = setTimeout(() => {
      autoAdvanceCountRef.current += 1;
      void handleContinue();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, thinking, speaking, expectsResponse, checkQuestion, beatIndex, messages.length, currentBeat]);

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
          courseSlug={course.slug}
          coursePublished={course.published}
          onSelectSlide={(slideIndex) => {
            const nextBeatIndex = beatIndexForSlide(lessonBeats, slideIndex);
            if (nextBeatIndex >= 0) void handleSelectBeat(nextBeatIndex);
          }}
          finalTest={plan.finalTest}
          finalTestActive={finalTestActive}
          onFinalTestComplete={() => {
            setFinalTestCompleted(true);
            setPresentation({
              type: "welcome",
              headline: "Course complete",
              body: "Great work finishing the final test. You can review any slide from the navigation bar above.",
            });
          }}
          onActivityComplete={() =>
            void (presentation.type === "video"
              ? handleContinue()
              : handleActivityComplete())
          }
        />

        {finalTestActive ? (
          <aside className="hidden border-l border-slate-200 bg-slate-50 px-6 py-8 lg:flex lg:flex-col lg:justify-center">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-700">
              Final test
            </p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">Complete the test on the left</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your instructor is paused while you finish the final assessment. Use the main
              screen to answer each question.
            </p>
          </aside>
        ) : (
          <TeacherChat
            messages={messages}
            thinking={thinking}
            checkQuestion={checkQuestion}
            onSelectOption={(option) => void handleSend(option)}
            needsAudioUnlock={needsAudioUnlock}
            speechToTextEnabled={builderConfig?.settings.speechText ?? true}
            awaitingInput={awaitingInput}
            inputPrompt={inputPrompt}
            onSend={handleSend}
            onSpeak={speak}
            onInteract={unlockAudio}
          />
        )}
      </div>
    </main>
  );
}
