"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClassroomPlan,
  PresentationView,
  PublicClassroomCourse,
} from "@/lib/classroom";
import { defaultClassroomBuilderConfig } from "@/lib/classroom-builder";
import {
  buildLessonBeats,
  presentationForBeat,
  type ClassroomLessonBeat,
} from "@/lib/classroom-lesson";
import ClassroomNav from "@/components/classroom/ClassroomNav";
import PresentationArea from "@/components/classroom/PresentationArea";
import TeacherChat, { type TeacherMessage } from "@/components/classroom/TeacherChat";

type ChatApiResponse = {
  reply?: string;
  presentation?: PresentationView;
  quickReplies?: string[];
  error?: string;
};

function topicForSlide(plan: ClassroomPlan, slideIndex: number) {
  return (
    plan.topics.find(
      (topic) => slideIndex >= topic.slideStart && slideIndex <= topic.slideEnd,
    ) || plan.topics[0]
  );
}

export default function ClassroomShell({
  course,
}: {
  course: PublicClassroomCourse;
}) {
  const plan = course.plan;
  const builderConfig = plan.config;
  const conversationMode =
    builderConfig?.settings.conversationMode || "interrupt-anytime";
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
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [completedTopicIds, setCompletedTopicIds] = useState<string[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [assessmentQuestionIndex, setAssessmentQuestionIndex] = useState(0);
  const [presentation, setPresentation] = useState<PresentationView>({
    type: "welcome",
    headline: plan.title,
    body: plan.opening,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const pendingSpeechRef = useRef<string | null>(null);
  const speakQueueRef = useRef<Promise<void>>(Promise.resolve());
  const speakRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  const activeTopic = useMemo(
    () => topicForSlide(plan, currentSlideIndex),
    [plan, currentSlideIndex],
  );

  const unlockAudio = useCallback(() => {
    audioUnlockedRef.current = true;
    const pending = pendingSpeechRef.current;
    if (pending) {
      pendingSpeechRef.current = null;
      setNeedsAudioUnlock(false);
      void speakRef.current(pending);
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void beginClass();
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  async function speak(text: string) {
    if (!voiceSettings.enabled || !text.trim()) return;

    const run = async () => {
      window.speechSynthesis.cancel();
      audioRef.current?.pause();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

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
        });
        if (!response.ok) throw new Error("speech failed");

        const url = URL.createObjectURL(await response.blob());
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
            pendingSpeechRef.current = text;
            setNeedsAudioUnlock(true);
            setSpeaking(false);
            return;
          }
        } else {
          await audio.play();
        }
      } catch {
        setSpeaking(false);
      }
    };

    speakQueueRef.current = speakQueueRef.current.then(run).catch(() => undefined);
    await speakQueueRef.current;
  }

  speakRef.current = speak;

  function applyBeat(
    beat: ClassroomLessonBeat,
    options?: { assessmentIndex?: number },
  ) {
    const view = presentationForBeat(
      plan,
      beat,
      options?.assessmentIndex ?? assessmentQuestionIndex,
    );
    setPresentation(view);
    if (view.type === "slide") {
      setCurrentSlideIndex(view.slideIndex);
    }
    if (
      view.type === "question" ||
      view.type === "exercise" ||
      view.type === "assessment"
    ) {
      setQuickReplies(view.choices || []);
    }
    return view;
  }

  async function sendToTeacher(
    nextMessages: TeacherMessage[],
    options?: { slideIndex?: number; presentation?: PresentationView },
  ) {
    setThinking(true);
    try {
      const response = await fetch("/api/classroom/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: course.slug,
          slideIndex: options?.slideIndex ?? currentSlideIndex,
          presentation: options?.presentation ?? presentation,
          messages: nextMessages,
        }),
      });
      const data = (await response.json()) as ChatApiResponse;
      const reply =
        data.reply ||
        data.error ||
        "Let's keep going. Tell me what you're thinking so far.";

      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      if (data.presentation) setPresentation(data.presentation);
      if (
        data.presentation?.type === "slide" &&
        typeof data.presentation.slideIndex === "number"
      ) {
        setCurrentSlideIndex(data.presentation.slideIndex);
      }
      if (data.quickReplies?.length) {
        setQuickReplies(data.quickReplies);
      } else if (lessonBeats[beatIndex]?.kind === "slide") {
        setQuickReplies(["Continue to next section", "I have a question"]);
      }
      void speak(reply);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The instructor could not respond.";
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: message,
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  async function teachSlideBeat(index: number, beat: ClassroomLessonBeat, baseMessages: TeacherMessage[]) {
    if (beat.kind !== "slide") return;
    const slide = plan.slides[beat.slideIndex];
    const view = applyBeat(beat);
    await sendToTeacher(
      [
        ...baseMessages,
        {
          role: "user",
          content: `Please teach slide ${beat.slideIndex + 1}: ${slide.title}.`,
        },
      ],
      {
        slideIndex: beat.slideIndex,
        presentation: view,
      },
    );
  }

  async function moveToBeat(
    nextIndex: number,
    baseMessages?: TeacherMessage[],
    options?: { assessmentIndex?: number },
  ) {
    const beat = lessonBeats[nextIndex];
    if (!beat) return;
    setBeatIndex(nextIndex);
    if (typeof options?.assessmentIndex === "number") {
      setAssessmentQuestionIndex(options.assessmentIndex);
    }

    if (beat.kind === "checkpoint" || beat.kind === "assessment") {
      applyBeat(beat, options);
      return;
    }

    if (beat.kind === "slide") {
      await teachSlideBeat(nextIndex, beat, baseMessages || messages);
      return;
    }

    applyBeat(beat, options);
  }

  async function advanceLesson(baseMessages: TeacherMessage[]) {
    const currentBeat = lessonBeats[beatIndex];
    if (currentBeat?.kind === "assessment") {
      const questions = plan.assessment || [];
      const nextQuestionIndex = assessmentQuestionIndex + 1;
      if (nextQuestionIndex < questions.length) {
        setAssessmentQuestionIndex(nextQuestionIndex);
        applyBeat(currentBeat, { assessmentIndex: nextQuestionIndex });
        return;
      }
    }

    const nextIndex = beatIndex + 1;
    if (nextIndex >= lessonBeats.length) {
      setQuickReplies(["That was helpful", "Can we review the key points?"]);
      return;
    }
    await moveToBeat(nextIndex, baseMessages);
  }

  async function beginClass() {
    const openingMessages: TeacherMessage[] = [
      {
        role: "assistant",
        content: `${plan.opening}\n\nBefore we dive in — what do you already know about ${plan.title.toLowerCase()}?`,
      },
    ];
    setMessages(openingMessages);
    setPresentation({
      type: "welcome",
      headline: plan.title,
      body: plan.opening,
    });
    setQuickReplies(
      conversationMode === "raise-hand"
        ? [
            "Raise your hand",
            "I know a little",
            "I'm brand new to this",
            "Could you start with the basics?",
          ]
        : [
            "I know a little",
            "I'm brand new to this",
            "I've seen this on the job",
            "Could you start with the basics?",
          ],
    );
    void speak(openingMessages[0].content);
  }

  async function handleSend(message: string) {
    unlockAudio();
    const next: TeacherMessage[] = [...messages, { role: "user", content: message }];
    setMessages(next);

    if (message === "Continue to next section") {
      await advanceLesson(next);
      return;
    }

    const currentBeat = lessonBeats[beatIndex];
    if (currentBeat?.kind === "checkpoint" || currentBeat?.kind === "assessment") {
      await sendToTeacher(next);
      await advanceLesson(next);
      return;
    }

    await sendToTeacher(next);
    if (currentBeat?.kind === "welcome") {
      await moveToBeat(1, next);
    }
  }

  async function handleSelectChoice(choice: string) {
    await handleSend(choice);
  }

  function handleSelectTopic(topic: (typeof plan.topics)[number]) {
    unlockAudio();
    setCurrentSlideIndex(topic.slideStart);
    setPresentation({
      type: "slide",
      slideIndex: topic.slideStart,
      headline: plan.slides[topic.slideStart]?.title,
    });
    void sendToTeacher(
      [
        ...messages,
        {
          role: "user",
          content: `Let's jump to "${topic.title}".`,
        },
      ],
      {
        slideIndex: topic.slideStart,
        presentation: {
          type: "slide",
          slideIndex: topic.slideStart,
          headline: plan.slides[topic.slideStart]?.title,
        },
      },
    );
  }

  function markTopicComplete(topicId: string) {
    setCompletedTopicIds((current) =>
      current.includes(topicId) ? current : [...current, topicId],
    );
  }

  useEffect(() => {
    if (!activeTopic) return;
    if (presentation.type === "slide" && presentation.slideIndex >= activeTopic.slideEnd) {
      markTopicComplete(activeTopic.id);
    }
  }, [presentation, activeTopic]);

  return (
    <main className="h-screen overflow-hidden bg-white text-slate-900">
      <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <div className="hidden min-h-0 overflow-hidden lg:block">
          <ClassroomNav
            plan={plan}
            activeTopicId={activeTopic?.id || null}
            completedTopicIds={completedTopicIds}
            onSelectTopic={handleSelectTopic}
          />
        </div>

        <PresentationArea
          plan={plan}
          view={presentation}
          onSelectChoice={(choice) => void handleSelectChoice(choice)}
        />

        <TeacherChat
          messages={messages}
          quickReplies={quickReplies}
          thinking={thinking}
          speaking={speaking}
          needsAudioUnlock={needsAudioUnlock}
          onSend={handleSend}
          onSpeak={speak}
          onInteract={unlockAudio}
        />
      </div>
    </main>
  );
}
