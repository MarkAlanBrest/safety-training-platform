"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Expand, LoaderCircle, Moon, Send, Sun, X } from "lucide-react";
import type { PlayerSettings } from "@/lib/mason";

type ChatEntry = { role: "user" | "assistant"; content: string };

export default function CourseToolbar({
  courseSlug,
  sectionIndex,
  sectionTitle,
  currentContext,
  settings,
  appearance,
  onAppearanceChange,
  raised = false,
}: {
  courseSlug: string;
  sectionIndex: number;
  sectionTitle: string;
  currentContext?: string;
  settings: PlayerSettings;
  appearance: "light" | "dark";
  onAppearanceChange: (appearance: "light" | "dark") => void;
  raised?: boolean;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const guided = settings.toolbarStyle === "guided";
  const coachEnabled = settings.aiCoach !== "off";

  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
    setQuestion("");
    setThinking(false);
  }, [sectionIndex]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function askCoach(event: FormEvent) {
    event.preventDefault();
    const clean = question.trim();
    if (!clean || thinking) return;

    const next: ChatEntry[] = [...messages, { role: "user" as const, content: clean }].slice(-8);
    setMessages(next);
    setQuestion("");
    setThinking(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch("/api/mason/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          courseSlug,
          sectionIndex,
          currentContext,
          messages: next,
        }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      const reply = data.reply || data.error || "I could not answer that just now.";
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      setMessages([
        ...next,
        {
          role: "assistant",
          content: timedOut
            ? "That answer took too long. Please ask again in a shorter way."
            : "I could not answer that just now. Please try again.",
        },
      ]);
    } finally {
      window.clearTimeout(timeout);
      abortRef.current = null;
      setThinking(false);
    }
  }

  async function enterFullscreen() {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  }

  const toolbarClass = appearance === "dark"
    ? "border-white/10 bg-slate-950 text-white"
    : "border-slate-200 bg-white text-slate-800";

  return (
    <>
      <div
        className={`fixed right-4 z-[65] flex items-center gap-1 rounded-full border p-1.5 shadow-[0_16px_45px_rgba(15,23,42,.22)] ${toolbarClass} ${raised ? "bottom-24" : "bottom-4"}`}
        aria-label="Course tools"
      >
        {coachEnabled && (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-3.5 text-sm font-bold text-slate-950"
            aria-label="Ask AI instructor"
          >
            <Bot size={18} /> {guided ? "Ask AI" : null}
          </button>
        )}
        <button
          type="button"
          onClick={() => onAppearanceChange(appearance === "dark" ? "light" : "dark")}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-500/10"
          aria-label={appearance === "dark" ? "Use light appearance" : "Use dark appearance"}
          title={appearance === "dark" ? "Light appearance" : "Dark appearance"}
        >
          {appearance === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          type="button"
          onClick={() => void enterFullscreen()}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-500/10"
          aria-label="Toggle fullscreen"
          title="Fullscreen"
        >
          <Expand size={18} />
        </button>
      </div>

      {chatOpen && coachEnabled && (
        <aside className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-[420px] flex-col border-l border-slate-200 bg-white text-slate-800 shadow-[-24px_0_70px_rgba(15,23,42,.22)]">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white">
            <div className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-slate-950">
                <Bot size={20} />
              </span>
              <div>
                <p className="font-bold">AI course instructor</p>
                <p className="mt-0.5 text-xs text-white/60">{sectionTitle}</p>
              </div>
            </div>
            <button type="button" onClick={() => setChatOpen(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Close AI instructor">
              <X size={19} />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
            {!messages.length && (
              <div className="rounded-2xl bg-slate-100 p-4 text-sm leading-6 text-slate-600">
                {settings.aiCoach === "guided"
                  ? "I can explain this topic another way, give you an example, or ask a practice question. What would help most?"
                  : "Ask for clarification, an example, or help applying this lesson."}
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {settings.knowledgeScope === "course"
                    ? "Answers are limited to this course."
                    : "Answers may add clearly labeled general knowledge."}
                </p>
              </div>
            )}
            {messages.map((entry, index) => (
              <div
                key={`${entry.role}-${index}`}
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  entry.role === "assistant"
                    ? "bg-slate-100 text-slate-700"
                    : "ml-auto bg-slate-950 text-white"
                }`}
              >
                {entry.content}
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <LoaderCircle className="animate-spin" size={16} /> Instructor is thinking…
              </div>
            )}
          </div>

          <form onSubmit={askCoach} className="border-t border-slate-200 p-4">
            <div className="flex gap-2 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-[var(--accent)]">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value.slice(0, 1000))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={2}
                placeholder="Ask about this lesson…"
                className="min-w-0 flex-1 resize-none px-2 py-1 text-sm leading-6 outline-none"
              />
              <button
                type="submit"
                disabled={thinking || !question.trim()}
                className="grid h-10 w-10 shrink-0 place-items-center self-end rounded-xl bg-slate-950 text-white disabled:opacity-35"
                aria-label="Send question"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">AI can make mistakes. Course rules and instructor guidance take priority.</p>
          </form>
        </aside>
      )}
    </>
  );
}
