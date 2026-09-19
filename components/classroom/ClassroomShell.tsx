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
  checkQuestionForBeat,
  navLabelForBeat,
  presentationForBeat,
} from "@/lib/classroom-lesson";
import { isLineupPlan } from "@/lib/classroom-lineup";
import {
  dedupeReplyWithCheckQuestion,
  embeddedNarrationWaitMs,
  filterPrivateSpeechDirections,
  shouldSpeakInstructorTurn,
  speakerNotesHaveEmbeddedNarration,
  speechChunks,
  speechTextForTurn,
  spokenTextFromSpeakerNotes,
} from "@/lib/classroom-speech";
import ClassroomTopBar from "@/components/classroom/ClassroomTopBar";
import PresentationArea from "@/components/classroom/PresentationArea";
import TeacherChat, { type TeacherMessage } from "@/components/classroom/TeacherChat";

/** Text at or under this length is played via a direct <audio src> GET request so the
 * browser can stream/play it progressively. Longer text falls back to POST + full
 * download (rare — replies are kept short by instruction) since it's safer than risking
 * an oversized URL. */
const MAX_STREAMABLE_SPEECH_LENGTH = 1500;
/** Pause after narration ends before the class auto-advances to the next beat. */
const AUTO_ADVANCE_DELAY_MS = 2_500;
/** Minimum time to stay on a beat before auto-advance can fire (avoids rushed jumps). */
const MIN_BEAT_DWELL_MS = 1_500;

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

type TeacherRequestOptions = {
  presentation?: PresentationView;
  slideIndex?: number;
  beatIndex?: number;
  includeImage?: boolean;
};

type PrefetchedTeacherTurn = {
  messages: TeacherMessage[];
  promise: Promise<ChatApiResponse>;
};

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
    ) ||
    /\bread\b[\s\S]{0,100}\b(?:text|words|bullets|content)\b[\s\S]{0,100}\b(?:slide|screen)\b/i.test(
      notes,
    ) ||
    /\bread\b[\s\S]{0,100}\b(?:slide|screen)\b[\s\S]{0,100}\b(?:text|words|bullets|content)\b/i.test(
      notes,
    )
  );
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
    // Ignore the generated welcome beat in older saved plans. The PowerPoint now
    // supplies the complete course, including any opening slide the author wants.
    () => (plan.lessonBeats || buildLessonBeats(plan)).filter((beat) => beat.kind !== "welcome"),
    [plan],
  );
  const lineupMode = useMemo(() => isLineupPlan(plan), [plan]);

  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [paused, setPaused] = useState(false);
  const [taughtSlideIndices, setTaughtSlideIndices] = useState<number[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [assessmentQuestionIndex, setAssessmentQuestionIndex] = useState(0);
  const [expectsResponse, setExpectsResponse] = useState(false);
  const [checkQuestion, setCheckQuestion] = useState<ClassroomCheckQuestion | null>(null);
  const [liveNarration, setLiveNarration] = useState("");
  const [narrationHistory, setNarrationHistory] = useState<string[]>([]);
  const [answeredCheckPrompts, setAnsweredCheckPrompts] = useState<string[]>([]);
  const [completedTestKeys, setCompletedTestKeys] = useState<string[]>([]);
  const [streak, setStreak] = useState<AnswerStreak>({ correctInRow: 0, incorrectInRow: 0 });
  const [presentation, setPresentation] = useState<PresentationView>({
    type: "slide",
    slideIndex: 0,
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
  const narratingRef = useRef(false);
  const narratingSessionRef = useRef(0);
  const navigationDepthRef = useRef(0);
  const beatSettledAtRef = useRef(Date.now());
  const prefetchedTurnRef = useRef<Map<number, PrefetchedTeacherTurn>>(new Map());
  const embeddedAudioHoldUntilRef = useRef(0);
  const immediateNarrationBeatRef = useRef<number | null>(null);

  const setSyncedNarration = useCallback((text: string) => {
    const cleaned = filterPrivateSpeechDirections(text).trim();
    if (!cleaned) return;
    setLiveNarration((current) => {
      if (current.trim()) {
        setNarrationHistory((history) => [...history, current.trim()]);
      }
      return cleaned;
    });
  }, []);

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

  useEffect(() => {
    if (startedRef.current || !lessonBeats.length) return;
    startedRef.current = true;
    void beginClass();
    // Begin once when the course opens; slide navigation handles later turns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    narratingSessionRef.current += 1;
    narratingRef.current = false;
    setNarrating(false);
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
    const narration = filterPrivateSpeechDirections(text);
    if (!voiceSettings.enabled || !narration.trim()) return;

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
        if (generation === speechGenerationRef.current) setSpeaking(false);
      } finally {
        if (generation === speechGenerationRef.current) setSpeaking(false);
      }
    };

    speakQueueRef.current = speakQueueRef.current.then(run).catch(() => undefined);
    await speakQueueRef.current;
  }

  function speakNatural(text: string) {
    const narration = filterPrivateSpeechDirections(text);
    if (!narration) return;
    const chunks = speechChunks(narration);
    const session = ++narratingSessionRef.current;

    narratingRef.current = true;
    setNarrating(true);

    const finishNarration = () => {
      if (session !== narratingSessionRef.current) return;
      narratingRef.current = false;
      setNarrating(false);
    };

    if (chunks.length <= 1) {
      void speak(narration).finally(finishNarration);
      return;
    }

    void (async () => {
      try {
        for (const chunk of chunks) {
          if (session !== narratingSessionRef.current) return;
          await speak(chunk);
        }
      } finally {
        finishNarration();
      }
    })();
  }

  function applyTeacherPresentation(view: PresentationView) {
    if (lineupMode && view.type === "slide") {
      // The client already advanced to the correct beat/slide before the AI
      // request finished. Re-applying the model's slide index can cause a second
      // jump and desync narration from what is on screen.
      setPresentation((current) =>
        current.type === "slide"
          ? { ...view, slideIndex: current.slideIndex }
          : view,
      );
      return;
    }

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
    options?: TeacherRequestOptions & {
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
    prefetchedResponse?: Promise<ChatApiResponse>,
  ) {
    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;
    const requestId = ++turnRequestIdRef.current;

    setThinking(true);
    try {
      const responsePromise = prefetchedResponse || fetch("/api/classroom/chat", {
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
          studentName: "",
          taughtSlideIndices,
          streak,
          answeredCheckPrompts,
        }),
        signal: controller.signal,
      });
      if (prefetchedResponse) {
        const data = await prefetchedResponse;
        if (controller.signal.aborted || requestId !== turnRequestIdRef.current) return;
        await applyTeacherTurn(data, nextMessages, options);
        return;
      }
      const response = await responsePromise as Response;
      if (controller.signal.aborted || requestId !== turnRequestIdRef.current) {
        return;
      }

      const data = (await response.json()) as ChatApiResponse;
      await applyTeacherTurn(data, nextMessages, options);
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

  async function applyTeacherTurn(
    data: ChatApiResponse,
    nextMessages: TeacherMessage[],
    options?: TeacherRequestOptions & { beatIndex?: number },
  ) {
      const reply =
        data.reply ||
        data.error ||
        "Let's keep going. Tell me what you're thinking so far.";

      const activeBeatIndex = options?.beatIndex ?? beatIndex;
      const authoredCheck = checkQuestionForBeat(plan, lessonBeats[activeBeatIndex] || lessonBeats[0]);
      const grading = typeof data.lastAnswerCorrect === "boolean";
      let nextCheckQuestion = data.checkQuestion || null;

      if (grading) {
        nextCheckQuestion = null;
        if (checkQuestion?.prompt) {
          const answered = checkQuestion.prompt.trim();
          setAnsweredCheckPrompts((current) =>
            current.includes(answered) ? current : [...current, answered],
          );
        }
      } else if (authoredCheck) {
        nextCheckQuestion = authoredCheck;
      }

      const displayReply = dedupeReplyWithCheckQuestion(reply, nextCheckQuestion);

      setThinking(false);
      setMessages([...nextMessages, { role: "assistant", content: displayReply }]);
      if (data.presentation) {
        applyTeacherPresentation(data.presentation);
      }
      setCheckQuestion(nextCheckQuestion);
      if (grading) {
        setStreak((current) =>
          data.lastAnswerCorrect
            ? { correctInRow: current.correctInRow + 1, incorrectInRow: 0 }
            : { correctInRow: 0, incorrectInRow: current.incorrectInRow + 1 },
        );
      }
      const needsResponse = grading
        ? false
        : Boolean(nextCheckQuestion) ||
          data.expectsResponse ||
          (data.presentation?.type === "question" ||
            data.presentation?.type === "exercise" ||
            data.presentation?.type === "assessment");
      setExpectsResponse(Boolean(needsResponse));

      const slideIndex = options?.slideIndex ?? currentSlideIndex;
      const speakerNotes = plan.slides[slideIndex]?.speakerNotes;
      const embeddedNarration =
        speakerNotesHaveEmbeddedNarration(speakerNotes) && !grading && !nextCheckQuestion;
      const narrationText = speechTextForTurn(displayReply, nextCheckQuestion);
      setSyncedNarration(narrationText);

      if (embeddedNarration) {
        embeddedAudioHoldUntilRef.current =
          Date.now() + embeddedNarrationWaitMs(speakerNotes);
        cancelSpeech();
      } else if (!needsResponse) {
        embeddedAudioHoldUntilRef.current = 0;
      }

      if (
        shouldSpeakInstructorTurn(speakerNotes, {
          checkQuestion: nextCheckQuestion,
          grading,
          reply: displayReply,
        })
      ) {
        const alreadySpokeNotes =
          immediateNarrationBeatRef.current === activeBeatIndex && !nextCheckQuestion;
        const notesText = spokenTextFromSpeakerNotes(speakerNotes || "");
        const skipDuplicate =
          alreadySpokeNotes &&
          !nextCheckQuestion &&
          Boolean(notesText) &&
          (narrationText === notesText ||
            narrationText.toLowerCase().startsWith(notesText.toLowerCase().slice(0, 48)));
        if (!skipDuplicate) {
          speakNatural(narrationText);
        }
        immediateNarrationBeatRef.current = null;
      } else {
        cancelSpeech();
      }

      if (!needsResponse && !nextCheckQuestion) {
        prefetchNextSlideTurn(activeBeatIndex, [
          ...nextMessages,
          { role: "assistant", content: displayReply },
        ]);
      }
  }

  function prefetchNextSlideTurn(
    currentBeatIndex: number,
    messagesAfterReply: TeacherMessage[],
  ) {
    const nextBeatIndex = currentBeatIndex + 1;
    const nextBeat = lessonBeats[nextBeatIndex];
    if (!nextBeat || nextBeat.kind !== "slide" || prefetchedTurnRef.current.has(nextBeatIndex)) {
      return;
    }

    const nextView = presentationForBeat(plan, nextBeat, assessmentQuestionIndex);
    const label = navLabelForBeat(nextBeat, plan);
    const nextMessages: TeacherMessage[] = [
      ...messagesAfterReply,
      {
        role: "user",
        hidden: true,
        content: `Let's go to "${label}" — continue teaching from there.`,
      },
    ];
    const notes = plan.slides[nextBeat.slideIndex]?.speakerNotes;
    const promise = fetch("/api/classroom/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug: course.slug,
        slideIndex: nextBeat.slideIndex,
        beatIndex: nextBeatIndex,
        assessmentQuestionIndex,
        presentation: nextView,
        messages: nextMessages,
        includeImage: !notes?.trim() || speakerNotesRequestVisualInspection(notes),
        studentName: "",
        taughtSlideIndices,
        streak,
        answeredCheckPrompts,
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as ChatApiResponse;
        if (!response.ok && !data.error) data.error = "The instructor could not respond.";
        return data;
      })
      .catch((error) => ({
        error: error instanceof Error ? error.message : "The instructor could not respond.",
      }));

    prefetchedTurnRef.current.set(nextBeatIndex, { messages: nextMessages, promise });
  }

  async function beginClass() {
    const firstBeat = lessonBeats[0];
    if (!firstBeat) return;

    const firstView = presentationForBeat(plan, firstBeat, assessmentQuestionIndex);
    const firstSlideIndex =
      firstBeat.kind === "slide"
        ? firstBeat.slideIndex
        : firstView.type === "slide"
          ? firstView.slideIndex
          : 0;

    setBeatIndex(0);
    setPresentation(firstView);
    setCurrentSlideIndex(firstSlideIndex);
    setExpectsResponse(false);
    setCheckQuestion(null);
    if (firstBeat.kind === "slide") markSlideTaught(firstBeat.slideIndex);

    const next: TeacherMessage[] = [
      {
        role: "user",
        hidden: true,
        content: "Begin with the first PowerPoint slide and follow its speaker notes.",
      },
    ];
    setMessages(next);
    await sendToTeacher(next, {
      presentation: firstView,
      slideIndex: firstSlideIndex,
      beatIndex: 0,
      includeImage:
        firstBeat.kind === "slide" &&
        (!plan.slides[firstBeat.slideIndex]?.speakerNotes?.trim() ||
          speakerNotesRequestVisualInspection(plan.slides[firstBeat.slideIndex]?.speakerNotes)),
    });
  }

  async function handleContinue() {
    if (
      navigationDepthRef.current > 0 ||
      narratingRef.current ||
      speaking ||
      thinking
    ) {
      return;
    }

    const nextBeatIndex = beatIndex + 1;
    if (nextBeatIndex >= lessonBeats.length) return;

    // Put the next visual on screen immediately, then let the instructor prepare its
    // narration. This removes the dead pause where the completed slide used to remain
    // visible throughout the entire AI request.
    await handleSelectBeat(nextBeatIndex);
  }

  async function handleSend(message: string) {
    unlockAudio();
    prefetchedTurnRef.current.clear();
    const next: TeacherMessage[] = [...messages, { role: "user", content: message }];
    setMessages(next);
    await sendToTeacher(next, { includeImage: false });
  }

  async function handleActivityComplete() {
    unlockAudio();
    prefetchedTurnRef.current.clear();
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

    const authoredCheck = checkQuestionForBeat(plan, beat);
    if (authoredCheck && answeredCheckPrompts.includes(authoredCheck.prompt.trim())) {
      if (nextBeatIndex + 1 < lessonBeats.length) {
        await handleSelectBeat(nextBeatIndex + 1);
      }
      return;
    }

    navigationDepthRef.current += 1;
    try {
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
      if (beat.kind === "slide" || view.type === "slide") {
        setCurrentSlideIndex(nextSlideIndex);
        markSlideTaught(nextSlideIndex);
      }

      if (beat.kind === "slide") {
        const notes = plan.slides[beat.slideIndex]?.speakerNotes;
        const notesText = spokenTextFromSpeakerNotes(notes || "");
        if (
          notesText &&
          !authoredCheck &&
          !speakerNotesHaveEmbeddedNarration(notes) &&
          voiceSettings.enabled
        ) {
          setSyncedNarration(notesText);
          speakNatural(notesText);
          immediateNarrationBeatRef.current = nextBeatIndex;
        }
      }

      // The Final Test is a standalone exam mode, not part of the AI chat loop.
      if (beat.kind === "finalTest" || beat.kind === "chapterTest") return;
      // Video moments are learner-controlled. Wait until playback finishes before
      // asking the instructor to continue to the next lesson beat.
      if (view.type === "video") return;

      const prefetched = prefetchedTurnRef.current.get(nextBeatIndex);
      prefetchedTurnRef.current.clear();
      const label = navLabelForBeat(beat, plan);
      const checkpoint =
        beat.kind === "checkpoint"
          ? plan.checkpoints?.find((item) => item.id === beat.checkpointId)
          : undefined;
      const next: TeacherMessage[] = prefetched?.messages || [
        ...messages,
        {
          role: "user",
          hidden: true,
          content: authoredCheck
            ? `We've reached the formative check "${checkpoint?.headline || label}". Give a one-sentence lead-in in reply only — the exact question is already shown in the Quick Check card. Do not repeat the question text or list its answer options in reply. Wait for the student's answer.`
            : `Let's go to "${label}" — continue teaching from there.`,
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
      }, prefetched?.promise);
    } finally {
      navigationDepthRef.current = Math.max(0, navigationDepthRef.current - 1);
      if (navigationDepthRef.current === 0) {
        beatSettledAtRef.current = Date.now();
      }
    }
  }

  const awaitingInput =
    !paused &&
    !thinking &&
    !speaking &&
    !narrating &&
    (expectsResponse ||
      Boolean(checkQuestion) ||
      presentation.type === "question" ||
      presentation.type === "exercise" ||
      presentation.type === "assessment");
  const inputPrompt =
    checkQuestion
      ? undefined
      : presentation.type === "question" ||
          presentation.type === "exercise" ||
          presentation.type === "assessment"
        ? presentation.prompt
        : undefined;

  const currentBeat = lessonBeats[beatIndex];
  const activeFinalTest =
    currentBeat?.kind === "chapterTest"
      ? plan.chapters?.[currentBeat.chapterIndex]?.finalTest
      : currentBeat?.kind === "finalTest"
        ? plan.finalTest
        : undefined;
  const activeTestKey =
    currentBeat?.kind === "chapterTest"
      ? `chapter-${currentBeat.chapterIndex}`
      : currentBeat?.kind === "finalTest"
        ? "final"
        : "";
  const finalTestActive =
    Boolean(activeFinalTest) && Boolean(activeTestKey) && !completedTestKeys.includes(activeTestKey);

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
    if (
      paused ||
      thinking ||
      speaking ||
      narrating ||
      narratingRef.current ||
      expectsResponse ||
      checkQuestion
    ) {
      return;
    }
    if (navigationDepthRef.current > 0) return;
    if (!messages.length) return;
    if (currentBeat?.kind === "finalTest" || currentBeat?.kind === "chapterTest") return;
    if (
      presentation.type === "video" ||
      presentation.type === "dragdrop" ||
      presentation.type === "hotspot" ||
      presentation.type === "flashcard"
    ) return;
    if (beatIndex >= lessonBeats.length - 1) return;
    if (autoAdvanceCountRef.current > 300) return;

    const elapsedOnBeat = Date.now() - beatSettledAtRef.current;
    const dwellRemaining = Math.max(0, MIN_BEAT_DWELL_MS - elapsedOnBeat);
    const embeddedHoldRemaining = Math.max(
      0,
      embeddedAudioHoldUntilRef.current - Date.now(),
    );
    const delay = AUTO_ADVANCE_DELAY_MS + dwellRemaining + embeddedHoldRemaining;

    const timer = setTimeout(() => {
      if (
        paused ||
        thinking ||
        speaking ||
        narratingRef.current ||
        navigationDepthRef.current > 0 ||
        expectsResponse ||
        checkQuestion
      ) {
        return;
      }
      autoAdvanceCountRef.current += 1;
      void handleContinue();
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paused,
    thinking,
    speaking,
    narrating,
    expectsResponse,
    checkQuestion,
    beatIndex,
    messages.length,
    currentBeat,
  ]);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-white text-slate-900">
      <ClassroomTopBar
        plan={plan}
        lessonBeats={lessonBeats}
        activeBeatIndex={beatIndex}
        activeSlideIndex={currentSlideIndex}
        onSelectSlide={(slideIndex) => {
          const nextBeatIndex = beatIndexForSlide(lessonBeats, slideIndex);
          if (nextBeatIndex >= 0) void handleSelectBeat(nextBeatIndex);
        }}
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
          finalTest={activeFinalTest}
          finalTestActive={finalTestActive}
          finalTestChapterPosition={
            currentBeat?.kind === "chapterTest" ? currentBeat.chapterIndex + 1 : undefined
          }
          onFinalTestComplete={() => {
            if (activeTestKey) {
              setCompletedTestKeys((current) =>
                current.includes(activeTestKey) ? current : [...current, activeTestKey],
              );
            }
            if (beatIndex < lessonBeats.length - 1) {
              void handleSelectBeat(beatIndex + 1);
            } else {
              setPresentation({
                type: "welcome",
                headline: "Course complete",
                body: "Great work finishing the course. You can review any chapter from the navigation bar above.",
              });
            }
          }}
          onActivityComplete={() =>
            void (presentation.type === "video"
              ? handleContinue()
              : handleActivityComplete())
          }
        />

        {finalTestActive ? (
          <aside className="hidden min-h-0 overflow-y-auto border-l border-slate-200 bg-slate-50 px-6 py-8 lg:flex lg:flex-col lg:justify-center">
            <div id="classroom-test-navigation" className="w-full" />
          </aside>
        ) : (
          <TeacherChat
            messages={messages}
            thinking={thinking}
            checkQuestion={checkQuestion}
            liveNarration={liveNarration}
            narrationHistory={narrationHistory}
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
