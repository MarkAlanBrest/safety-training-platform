"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, MessageCircleQuestion, Mic, MicOff, Send, Volume2 } from "lucide-react";

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
  quickReplies: _quickReplies,
  thinking,
  speaking,
  needsAudioUnlock = false,
  speechToTextEnabled = false,
  awaitingInput = false,
  inputPrompt,
  onSend,
  onSpeak,
  onInteract,
  onAskQuestion,
}: {
  messages: TeacherMessage[];
  quickReplies: string[];
  thinking: boolean;
  speaking: boolean;
  needsAudioUnlock?: boolean;
  speechToTextEnabled?: boolean;
  awaitingInput?: boolean;
  inputPrompt?: string;
  onSend: (message: string) => Promise<void>;
  onSpeak: (text: string) => Promise<void>;
  onInteract?: () => void;
  onAskQuestion?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
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
    if (awaitingInput && !thinking) {
      inputRef.current?.focus();
    }
  }, [awaitingInput, thinking, inputPrompt]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean || thinking) return;
    onInteract?.();
    setDraft("");
    await onSend(clean);
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

  const showMic = speechToTextEnabled && speechSupported;
  const teacherState = needsAudioUnlock
    ? "Tap Hear this to unlock audio"
    : thinking
      ? "Thinking…"
      : speaking
        ? "Speaking…"
        : listening
          ? "Listening…"
          : awaitingInput
            ? "Waiting for your response"
            : "Leading the lesson";

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f2b46] text-amber-300">
            <Bot size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900">AI Teacher</p>
            <p className="truncate text-xs text-emerald-600">{teacherState}</p>
          </div>
        </div>
        {onAskQuestion ? (
          <button
            type="button"
            onClick={() => {
              onInteract?.();
              onAskQuestion();
            }}
            disabled={thinking}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50"
          >
            <MessageCircleQuestion size={16} />
            Ask a question
          </button>
        ) : null}
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {!messages.length && (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
            Your instructor leads this session. When it is your turn, type or speak in the
            response box below.
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

      <div
        className={`shrink-0 border-t-2 px-4 py-4 transition-colors ${
          awaitingInput
            ? "border-amber-400 bg-amber-50 shadow-[0_-12px_32px_rgba(251,191,36,.2)]"
            : "border-slate-200 bg-white"
        }`}
      >
        {awaitingInput ? (
          <div className="mb-3 rounded-xl border border-amber-300 bg-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-amber-700">
              Your turn
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {inputPrompt
                ? "Answer the question below"
                : "Type or speak your response"}
            </p>
            {inputPrompt ? (
              <p className="mt-2 text-sm leading-6 text-slate-600">{inputPrompt}</p>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={submit} className="flex gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => onInteract?.()}
            placeholder={
              listening
                ? "Listening…"
                : awaitingInput
                  ? "Type your answer here…"
                  : "Type or speak when ready…"
            }
            className={`min-w-0 flex-1 rounded-2xl border px-4 py-3.5 text-sm font-medium outline-none transition ${
              awaitingInput
                ? "border-amber-400 bg-white ring-2 ring-amber-200 focus:border-amber-500 focus:ring-amber-300"
                : "border-slate-300 bg-white focus:border-amber-400"
            }`}
          />
          {showMic ? (
            <button
              type="button"
              onClick={toggleListening}
              disabled={thinking}
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${
                listening
                  ? "border-rose-400 bg-rose-50 text-rose-600 ring-2 ring-rose-200"
                  : awaitingInput
                    ? "border-amber-400 bg-amber-100 text-amber-800"
                    : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
              aria-label={listening ? "Stop listening" : "Speak your answer"}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={thinking || !draft.trim()}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white transition disabled:opacity-40 ${
              awaitingInput ? "bg-amber-600 hover:bg-amber-700" : "bg-[#0f2b46]"
            }`}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </aside>
  );
}
