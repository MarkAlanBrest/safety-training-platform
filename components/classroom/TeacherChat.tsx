"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Hand, Mic, MicOff, Radio, Send, Volume2 } from "lucide-react";
import { DEFAULT_QUICK_REPLIES } from "@/lib/classroom";
import type { RealtimeTeacherStatus } from "@/components/classroom/ClassroomShell";

export type TeacherMessage = {
  role: "user" | "assistant";
  content: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition():
  | (new () => SpeechRecognitionLike)
  | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition;
}

export default function TeacherChat({
  messages,
  quickReplies,
  thinking,
  speaking,
  needsAudioUnlock = false,
  speechToTextEnabled = false,
  onSend,
  onSpeak,
  onInteract,
  focusRequest = 0,
  realtimeStatus = "off",
  realtimeError,
  onToggleRealtime,
}: {
  messages: TeacherMessage[];
  quickReplies: string[];
  thinking: boolean;
  speaking: boolean;
  needsAudioUnlock?: boolean;
  speechToTextEnabled?: boolean;
  onSend: (message: string) => Promise<void>;
  onSpeak: (text: string) => Promise<void>;
  onInteract?: () => void;
  focusRequest?: number;
  realtimeStatus?: RealtimeTeacherStatus;
  realtimeError?: string | null;
  onToggleRealtime?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const speechSupported = Boolean(getSpeechRecognition());

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (focusRequest > 0) inputRef.current?.focus();
  }, [focusRequest]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean || thinking) return;
    onInteract?.();
    setDraft("");
    await onSend(clean);
  }

  async function sendQuickReply(reply: string) {
    if (thinking) return;
    onInteract?.();
    await onSend(reply);
  }

  function toggleListening() {
    if (!speechSupported || thinking) return;
    onInteract?.();

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setDraft(transcript.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognition.start();
    setListening(true);
  }

  const replies = quickReplies.length ? quickReplies : DEFAULT_QUICK_REPLIES;
  const showMic = speechToTextEnabled && speechSupported;
  const realtimeActive = !["off", "error"].includes(realtimeStatus);
  const teacherState =
    realtimeStatus === "connecting"
      ? "Connecting to your instructor…"
      : realtimeStatus === "listening"
        ? "Listening—go ahead"
        : realtimeStatus === "thinking"
          ? "Thinking…"
          : realtimeStatus === "speaking"
            ? "Speaking—you can interrupt"
            : needsAudioUnlock
              ? "Tap a reply to hear your instructor"
              : thinking
                ? "Thinking…"
                : speaking
                  ? "Speaking…"
                  : listening
                    ? "Listening…"
                    : "Ready to talk";

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f2b46] text-amber-300">
            <Bot size={22} />
          </span>
          <div>
            <p className="font-bold text-slate-900">AI Teacher</p>
            <p className="text-xs text-emerald-600">
              {needsAudioUnlock
                ? "Tap a reply to hear your instructor"
                : thinking
                  ? "Thinking…"
                  : speaking
                    ? "Speaking…"
                    : listening
                      ? "Listening…"
                      : "Ready to talk"}
            </p>
          </div>
        </div>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {!messages.length && (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
            Your instructor will teach from your PowerPoint slides, ask questions, and respond here.
            {showMic ? " Tap the microphone to speak your answer." : " Type or use quick replies."}
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-2xl px-4 py-3 text-sm leading-7 ${
              message.role === "assistant"
                ? "bg-[#f1f5f9] text-slate-800"
                : "bg-[#0f2b46] text-white"
            }`}
          >
            {message.content}
            {message.role === "assistant" ? (
              <button
                type="button"
                onClick={() => {
                  onInteract?.();
                  void onSpeak(message.content);
                }}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"
              >
                <Volume2 size={14} />
                Hear this
              </button>
            ) : null}
          </div>
        ))}
        {thinking ? (
          <div className="rounded-2xl bg-[#f1f5f9] px-4 py-3 text-sm leading-7 text-slate-500">
            Instructor is thinking…
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-200 px-4 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {replies.map((reply) => (
            <button
              key={reply}
              type="button"
              disabled={thinking}
              onClick={() => void sendQuickReply(reply)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:opacity-40"
            >
              {reply === "Raise your hand" ? (
                <span className="inline-flex items-center gap-1">
                  <Hand size={12} />
                  {reply}
                </span>
              ) : (
                reply
              )}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => onInteract?.()}
            placeholder={listening ? "Listening…" : "Talk with your instructor…"}
            className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-amber-400"
          />
          {showMic ? (
            <button
              type="button"
              onClick={toggleListening}
              disabled={thinking}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${
                listening
                  ? "border-rose-300 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
              aria-label={listening ? "Stop listening" : "Speak your answer"}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={thinking || !draft.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0f2b46] text-white disabled:opacity-40"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}
