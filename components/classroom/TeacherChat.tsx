"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Lightbulb,
  MessageCircleQuestion,
  Mic,
  MicOff,
  Send,
  RefreshCw,
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
  onSelectOption,
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
  /** The live comprehension check, if any — shown by itself, replacing the narration text. */
  checkQuestion?: ClassroomCheckQuestion | null;
  onSelectOption?: (option: string) => void;
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
  const [transcriptOpen, setTranscriptOpen] = useState(false);
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean || thinking) return;
    onInteract?.();
    setDraft("");
    setAsking(false);
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

        {checkQuestion ? (
          <QuickCheckCard
            question={checkQuestion}
            onSelectOption={awaitingInput ? onSelectOption : undefined}
            disabled={thinking}
          />
        ) : !visibleMessages.length ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center text-sm leading-7 text-slate-600">
            Your instructor leads this session and paces the class for you. Ask a question
            any time you want to jump in.
          </div>
        ) : lastMessage?.role === "user" ? (
          <div className="space-y-3">
            <div className="ml-auto max-w-[85%] rounded-2xl bg-[#0f2b46] px-4 py-3 text-sm leading-7 text-white">
              {lastMessage.content}
            </div>
            {thinking ? (
              <div className="rounded-2xl bg-[#f1f5f9] px-4 py-3 text-sm leading-7 text-slate-500">
                Instructor is thinking…
              </div>
            ) : null}
          </div>
        ) : lastMessage?.content ? (
          transcriptOpen ? (
            <div className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <FileText size={16} />
                  Class transcript
                </span>
                <button
                  type="button"
                  onClick={() => setTranscriptOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label="Close transcript"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3 overflow-y-auto p-4">
                {visibleMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}-${message.content}`}
                    className={`rounded-xl px-3 py-2.5 text-sm leading-6 ${
                      message.role === "user"
                        ? "ml-6 bg-[#0f2b46] text-white"
                        : "mr-6 bg-white text-slate-700 shadow-sm"
                    }`}
                  >
                    {message.content}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">
                Interact with your teacher
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => void onSend("Please explain that another way.")}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50"
                >
                  <RefreshCw size={16} className="text-amber-600" />
                  Explain that another way
                </button>
                <button
                  type="button"
                  onClick={() => void onSend("Please give me a practical example of that.")}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50"
                >
                  <Lightbulb size={16} className="text-amber-600" />
                  Give me an example
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onInteract?.();
                    void onSpeak(lastMessage.content);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50"
                >
                  <Volume2 size={16} className="text-amber-600" />
                  Repeat the narration
                </button>
              </div>
              <button
                type="button"
                onClick={() => setTranscriptOpen(true)}
                className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                <FileText size={14} />
                View transcript
              </button>
            </div>
          )
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
