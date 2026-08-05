"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  MessageCircleQuestion,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { ClassroomCheckQuestion } from "@/lib/classroom";
import QuickCheckCard from "@/components/classroom/QuickCheckCard";

export type TeacherMessage = {
  role: "user" | "assistant";
  content: string;
  /** Internal control messages are sent to the AI but never shown in the chat window. */
  hidden?: boolean;
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
  thinking,
  checkQuestion,
  needsAudioUnlock = false,
  speechToTextEnabled = false,
  awaitingInput = false,
  inputPrompt,
  onSend,
  onSpeak,
  onInteract,
  onForward,
  onBack,
  canGoBack = false,
}: {
  messages: TeacherMessage[];
  thinking: boolean;
  checkQuestion?: ClassroomCheckQuestion | null;
  needsAudioUnlock?: boolean;
  speechToTextEnabled?: boolean;
  awaitingInput?: boolean;
  inputPrompt?: string;
  onSend: (message: string) => Promise<void>;
  onSpeak: (text: string) => Promise<void>;
  onInteract?: () => void;
  onForward?: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [asking, setAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = Boolean(getSpeechRecognition());

  const showInput = awaitingInput || asking;
  const visibleMessages = messages.filter((message) => !message.hidden);
  const lastMessage = visibleMessages[visibleMessages.length - 1];

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (showInput && !thinking) {
      inputRef.current?.focus();
    }
  }, [showInput, thinking, inputPrompt]);

  useEffect(() => {
    if (awaitingInput) setAsking(false);
  }, [awaitingInput]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean || thinking) return;
    onInteract?.();
    setDraft("");
    setAsking(false);
    await onSend(clean);
  }

  async function selectOption(option: string) {
    if (thinking) return;
    onInteract?.();
    setDraft("");
    setAsking(false);
    await onSend(option);
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

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto px-5 py-6">
        {needsAudioUnlock ? (
          <button
            type="button"
            onClick={() => onInteract?.()}
            className="flex w-full items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-800"
          >
            <VolumeX size={16} className="shrink-0" />
            Tap to enable the instructor&apos;s voice
          </button>
        ) : null}

        {!visibleMessages.length ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center text-sm leading-7 text-slate-600">
            Your instructor leads this session and paces the class for you. Ask a question
            any time you want to jump in.
          </div>
        ) : lastMessage?.role === "user" ? (
          <div className="space-y-3">
            {checkQuestion ? <QuickCheckCard question={checkQuestion} /> : null}
            <div className="ml-auto max-w-[85%] rounded-2xl bg-[#0f2b46] px-4 py-3 text-sm leading-7 text-white">
              {lastMessage.content}
            </div>
            {thinking ? (
              <div className="rounded-2xl bg-[#f1f5f9] px-4 py-3 text-sm leading-7 text-slate-500">
                Instructor is thinking…
              </div>
            ) : null}
          </div>
        ) : lastMessage ? (
          <div className="space-y-3">
            {lastMessage.content ? (
              <div
                key={lastMessage.content}
                className="rounded-2xl bg-[#f1f5f9] px-4 py-4 text-base leading-7 text-slate-800"
              >
                {lastMessage.content}
                <button
                  type="button"
                  onClick={() => {
                    onInteract?.();
                    void onSpeak(lastMessage.content);
                  }}
                  className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500"
                >
                  <Volume2 size={14} />
                  Hear this
                </button>
              </div>
            ) : null}
            {checkQuestion ? (
              <QuickCheckCard
                question={checkQuestion}
                onSelectOption={awaitingInput ? selectOption : undefined}
                disabled={thinking}
              />
            ) : null}
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

        {showInput ? (
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
                    : "Type your question here…"
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
            {asking && !awaitingInput ? (
              <button
                type="button"
                onClick={() => {
                  setAsking(false);
                  setDraft("");
                }}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500"
                aria-label="Cancel question"
              >
                <X size={18} />
              </button>
            ) : null}
          </form>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onInteract?.();
                onBack?.();
              }}
              disabled={thinking || !canGoBack}
              aria-label="Previous slide"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-300 bg-white text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-40"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                onInteract?.();
                setAsking(true);
              }}
              disabled={thinking}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50"
            >
              <MessageCircleQuestion size={16} />
              Ask a question
            </button>
            <button
              type="button"
              onClick={() => {
                onInteract?.();
                onForward?.();
              }}
              disabled={thinking || !onForward}
              aria-label="Skip ahead"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#0f2b46] text-white transition hover:bg-[#163a5d] disabled:opacity-50"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
