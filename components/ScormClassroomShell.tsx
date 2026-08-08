"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ScormPlayer, { type ScormRuntimeChange } from "@/components/ScormPlayer";
import TeacherChat, { type TeacherMessage } from "@/components/classroom/TeacherChat";
import { useInstructorVoice } from "@/lib/instructor-voice";
import {
  narrationForLocation,
  scormLocationFromRuntime,
  type ScormInstructorConfig,
} from "@/lib/scorm-instructor";

type ChatApiResponse = {
  reply?: string;
  expectsResponse?: boolean;
  error?: string;
};

export type PublicScormCourse = {
  title: string;
  slug: string;
  description: string | null;
  scormVersion: string;
  scormEntryPoint: string;
  instructor: ScormInstructorConfig;
};

const LOCATION_KEYS = new Set([
  "cmi.core.lesson_location",
  "cmi.location",
  "cmi.suspend_data",
]);

export default function ScormClassroomShell({
  course,
  preview = false,
}: {
  course: PublicScormCourse;
  preview?: boolean;
}) {
  const searchParams = useSearchParams();
  const code = searchParams?.get("code") || "";
  const welcomedRef = useRef(false);
  const spokenLocationsRef = useRef<Set<string>>(new Set());
  const locationRef = useRef("");

  const voiceSettings = useMemo(
    () => ({
      enabled: course.instructor.settings.speechVoice,
      provider: course.instructor.teaching.voiceProvider,
      voice: course.instructor.teaching.voice,
      speed: course.instructor.teaching.voiceSpeed,
    }),
    [course.instructor],
  );

  const { speak, cancelSpeech, unlockAudio, speaking, needsAudioUnlock } =
    useInstructorVoice(voiceSettings);

  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [chatError, setChatError] = useState("");
  const [liveNarration, setLiveNarration] = useState("");
  const [narrationHistory, setNarrationHistory] = useState<string[]>([]);

  const appendNarration = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLiveNarration((current) => {
      if (current && current !== trimmed) {
        setNarrationHistory((history) => [...history, current]);
      }
      return trimmed;
    });
  }, []);

  const sendToInstructor = useCallback(
    async (nextMessages: TeacherMessage[], options?: { speakReply?: boolean }) => {
      setThinking(true);
      setChatError("");
      try {
        const response = await fetch(`/api/scorm/${encodeURIComponent(course.slug)}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: preview ? undefined : code,
            preview,
            messages: nextMessages
              .filter((message) => !message.hidden)
              .map((message) => ({ role: message.role, content: message.content })),
            scormLocation: locationRef.current,
          }),
        });
        const payload = (await response.json()) as ChatApiResponse;
        if (!response.ok) throw new Error(payload.error || "The instructor could not respond.");

        const reply = payload.reply?.trim() || "";
        if (reply) {
          setMessages((current) => [...current, { role: "assistant", content: reply }]);
          appendNarration(reply);
          if (options?.speakReply !== false) await speak(reply);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The instructor could not respond.";
        setChatError(message);
      } finally {
        setThinking(false);
      }
    },
    [appendNarration, code, course.slug, preview, speak],
  );

  const handleRuntimeChange = useCallback(
    (change: ScormRuntimeChange) => {
      if (!LOCATION_KEYS.has(change.key)) return;
      const location = scormLocationFromRuntime(change.snapshot);
      locationRef.current = location;
      if (!location || spokenLocationsRef.current.has(location)) return;

      const cue = narrationForLocation(course.instructor.narration, location);
      if (!cue) return;

      spokenLocationsRef.current.add(location);
      setMessages((current) => [...current, { role: "assistant", content: cue.text }]);
      appendNarration(cue.text);
      void speak(cue.text);
    },
    [appendNarration, course.instructor.narration, speak],
  );

  useEffect(() => {
    if (welcomedRef.current) return;
    welcomedRef.current = true;
    const opening =
      course.instructor.opening?.trim() ||
      course.description?.trim() ||
      `Welcome to ${course.title}. Work through the lesson on the left, and ask me questions here anytime.`;
    setMessages([{ role: "assistant", content: opening }]);
    appendNarration(opening);
    void speak(opening);
  }, [appendNarration, course.description, course.instructor.opening, course.title, speak]);

  const handleSend = useCallback(
    async (message: string) => {
      unlockAudio();
      cancelSpeech();
      const next: TeacherMessage[] = [...messages, { role: "user", content: message }];
      setMessages(next);
      await sendToInstructor(next);
    },
    [cancelSpeech, messages, sendToInstructor, unlockAudio],
  );

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-white text-slate-900">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#c68b1b]">
            SCORM {course.scormVersion}
            {preview ? " · Preview" : ""}
          </p>
          <h1 className="text-lg font-semibold text-[#10283f]">{course.title}</h1>
        </div>
        <p className="text-xs font-semibold text-slate-500">
          Voice: {voiceSettings.provider === "premium" ? "Premium" : "Browser"}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-0 bg-[#0b1f33]">
          <ScormPlayer
            title={course.title}
            slug={course.slug}
            entryPoint={course.scormEntryPoint}
            version={course.scormVersion}
            preview={preview}
            embedded
            onRuntimeChange={handleRuntimeChange}
          />
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
            speechToTextEnabled={course.instructor.settings.speechText}
            needsAudioUnlock={needsAudioUnlock}
            liveNarration={liveNarration}
            narrationHistory={narrationHistory}
            onSend={handleSend}
            onSpeak={speak}
            onInteract={unlockAudio}
          />
        </div>
      </div>
    </main>
  );
}
