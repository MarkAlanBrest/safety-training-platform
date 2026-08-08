"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ClassroomCheckQuestion, PublicClassroomCourse } from "@/lib/classroom";
import { defaultClassroomBuilderConfig } from "@/lib/classroom-builder";
import { markerToCheckQuestion } from "@/lib/classroom-video";
import type { VideoTimelineMarker } from "@/lib/classroom-video";
import TeacherChat, { type TeacherMessage } from "@/components/classroom/TeacherChat";
import VideoClassroomPlayer, {
  type VideoClassroomPlayerHandle,
} from "@/components/classroom/VideoClassroomPlayer";
import QuickCheckCard from "@/components/classroom/QuickCheckCard";

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
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [checkQuestion, setCheckQuestion] = useState<ClassroomCheckQuestion | null>(null);
  const [expectsResponse, setExpectsResponse] = useState(false);
  const [overlayPrompt, setOverlayPrompt] = useState<string | null>(null);
  const [activeMarker, setActiveMarker] = useState<VideoTimelineMarker | null>(null);
  const [awaitingMarkerResume, setAwaitingMarkerResume] = useState(false);
  const startedRef = useRef(false);

  if (!videoCourse?.videoUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 px-8 text-center text-white">
        <p>This video course is missing its media file.</p>
      </div>
    );
  }

  async function speak(text: string) {
    if (!voiceSettings.enabled || !text.trim()) return;
    try {
      const url = `/api/mason/speech?${new URLSearchParams({
        text,
        voice: voiceSettings.voice,
        speed: String(voiceSettings.speed),
      }).toString()}`;
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("speech failed"));
        void audio.play().catch(reject);
      });
    } catch {
      // Speech is optional — continue the lesson if TTS fails.
    }
  }

  const resumePlayback = useCallback(() => {
    setCheckQuestion(null);
    setExpectsResponse(false);
    setOverlayPrompt(null);
    setActiveMarker(null);
    setAwaitingMarkerResume(false);
    playerRef.current?.play();
  }, []);

  async function sendToTeacher(nextMessages: TeacherMessage[]) {
    setThinking(true);
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
      const data = (await response.json()) as ChatApiResponse;
      const reply =
        data.reply || data.error || "I'm here if you have questions about this part of the lesson.";
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      setExpectsResponse(Boolean(data.expectsResponse));
      setCheckQuestion(data.checkQuestion || null);
      if (reply.trim()) await speak(reply);
    } finally {
      setThinking(false);
    }
  }

  async function handleMarkerReached(marker: VideoTimelineMarker) {
    setActiveMarker(marker);

    if (marker.kind === "continue") {
      window.setTimeout(() => resumePlayback(), 400);
      return;
    }

    if (marker.kind === "ai_say") {
      const script = marker.aiScript?.trim() || marker.label?.trim() || "";
      if (script) {
        setOverlayPrompt(script);
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
  }

  async function handleSend(message: string) {
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
  }

  async function beginClass() {
    if (startedRef.current) return;
    startedRef.current = true;
    const intro: TeacherMessage[] = [
      {
        role: "user",
        hidden: true,
        content:
          "The student just opened this video course. Give a one-sentence welcome and tell them they can press Ask AI anytime.",
      },
    ];
    setChatOpen(true);
    await sendToTeacher(intro);
    setChatOpen(false);
    playerRef.current?.play();
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <VideoClassroomPlayer
        ref={playerRef}
        title={course.title}
        videoUrl={videoCourse.videoUrl}
        captionsUrl={videoCourse.captionsUrl}
        chapters={videoCourse.chapters}
        markers={videoCourse.markers}
        onMarkerReached={(marker) => void handleMarkerReached(marker)}
        onAskAi={() => {
          setChatOpen(true);
          if (!startedRef.current) void beginClass();
        }}
        pausedExternally={chatOpen || awaitingMarkerResume}
      />

      {overlayPrompt && !chatOpen ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
          <div className="max-w-2xl rounded-2xl bg-slate-950/85 px-5 py-4 text-center text-sm leading-6 text-white backdrop-blur">
            {overlayPrompt}
          </div>
        </div>
      ) : null}

      {checkQuestion && awaitingMarkerResume && !chatOpen ? (
        <div className="absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl border border-amber-300/30 bg-slate-950/90 p-4 backdrop-blur">
            <QuickCheckCard
              question={checkQuestion}
              disabled={thinking}
              onSelectOption={(option) => void handleSend(option)}
            />
          </div>
        </div>
      ) : null}

      {chatOpen ? (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6">
          <div className="flex h-[min(720px,92dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">AI Instructor</p>
                <p className="text-xs text-slate-500">Video is paused while you chat.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChatOpen(false);
                  if (!awaitingMarkerResume) playerRef.current?.play();
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <TeacherChat
                messages={messages}
                thinking={thinking}
                checkQuestion={checkQuestion}
                onSelectOption={(option) => void handleSend(option)}
                speechToTextEnabled={builderConfig.settings.speechText}
                awaitingInput={expectsResponse || Boolean(checkQuestion)}
                onSend={handleSend}
                onSpeak={speak}
              />
            </div>
          </div>
        </div>
      ) : null}

      {!startedRef.current ? (
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
  );
}
