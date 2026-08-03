"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Hand, Send, Volume2 } from "lucide-react";
import { DEFAULT_QUICK_REPLIES } from "@/lib/classroom";

export type TeacherMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function TeacherChat({
  messages,
  quickReplies,
  thinking,
  speaking,
  needsAudioUnlock = false,
  onSend,
  onSpeak,
  onInteract,
}: {
  messages: TeacherMessage[];
  quickReplies: string[];
  thinking: boolean;
  speaking: boolean;
  needsAudioUnlock?: boolean;
  onSend: (message: string) => Promise<void>;
  onSpeak: (text: string) => Promise<void>;
  onInteract?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, thinking, speaking]);

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

  const replies = quickReplies.length ? quickReplies : DEFAULT_QUICK_REPLIES;

  return (
    <aside className="flex h-full flex-col border-l border-slate-200 bg-white">
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
                    : "Ready to talk"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!messages.length && (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
            Your instructor will teach, ask questions, and respond to you here. Use the
            quick replies or type your own answer.
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
        <div ref={bottomRef} aria-hidden="true" className="h-px shrink-0" />
      </div>

      <div className="border-t border-slate-200 px-4 py-4">
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
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => onInteract?.()}
            placeholder="Talk with your instructor…"
            className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-amber-400"
          />
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
