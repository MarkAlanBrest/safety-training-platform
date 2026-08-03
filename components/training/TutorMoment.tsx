"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Send, Volume2 } from "lucide-react";
import type { LessonMoment } from "@/lib/mason";
import HotspotActivity from "@/components/training/HotspotActivity";

type ChatEntry = { role: "user" | "assistant"; content: string };

export default function TutorMoment({
  moment,
  courseSlug,
  sectionIndex,
}: {
  moment: LessonMoment;
  courseSlug: string;
  sectionIndex: number;
}) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [introduced, setIntroduced] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (introduced || !moment.narration.trim()) return;
    setIntroduced(true);
    void speak(moment.narration);
  }, [introduced, moment.narration]);

  async function speak(text: string) {
    if (!text.trim()) return;
    audioRef.current?.pause();
    setSpeaking(true);
    try {
      const response = await fetch("/api/mason/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("speech failed");
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }

  async function askTutor(event: FormEvent) {
    event.preventDefault();
    const clean = question.trim();
    if (!clean || thinking) return;
    const next: ChatEntry[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setQuestion("");
    setThinking(true);
    try {
      const response = await fetch("/api/mason/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          sectionIndex,
          messages: next,
        }),
      });
      const data = await response.json();
      const reply =
        data.reply || data.error || "I could not answer that just now. Try again.";
      setMessages([...next, { role: "assistant", content: reply }]);
      void speak(reply);
    } finally {
      setThinking(false);
    }
  }

  return (
    <section className="my-14">
      <div className="overflow-hidden rounded-2xl border border-[var(--accent)]/25 bg-gradient-to-br from-[var(--pale)]/70 to-white shadow-[0_24px_70px_rgba(15,23,42,.08)]">
        <div className="h-1.5 bg-gradient-to-r from-[var(--accent)] to-[var(--dark)]" />
        <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
          <div className="px-7 py-9 sm:px-10 sm:py-11">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--dark)] text-[var(--accent)]">
                <Bot size={24} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--accent)]">
                  AI instructor
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">
                  {moment.title}
                </h2>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Volume2 size={16} className={speaking ? "text-[var(--accent)]" : ""} />
                {speaking ? "Instructor is speaking…" : "Instructor guidance"}
              </div>
              <p className="mt-3 text-lg leading-8 text-slate-700">{moment.narration}</p>
              {moment.prompt && (
                <p className="mt-4 border-t border-slate-100 pt-4 text-base font-semibold leading-7 text-[var(--ink)]">
                  {moment.prompt}
                </p>
              )}
            </div>

            {moment.sourceImage && moment.hotspotPoints?.length ? (
              <div className="mt-6 [&_section]:my-0 [&_section>div]:border-0 [&_section>div]:shadow-none [&_section>div]:bg-transparent [&_section>div]:p-0">
                <HotspotActivity moment={moment} />
              </div>
            ) : null}
          </div>

          <aside className="border-t border-slate-200/80 bg-white lg:border-l lg:border-t-0">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-sm font-bold text-[var(--ink)]">Ask your instructor</p>
              <p className="mt-1 text-xs text-slate-500">
                Questions stay grounded in this section.
              </p>
            </div>
            <div className="flex h-[280px] flex-col px-5 py-4 lg:h-full lg:min-h-[360px]">
              <div className="flex-1 space-y-3 overflow-y-auto">
                {!messages.length && (
                  <p className="text-sm leading-6 text-slate-500">
                    Ask for clarification, an example, or help applying the idea.
                  </p>
                )}
                {messages.map((entry, index) => (
                  <div
                    key={`${entry.role}-${index}`}
                    className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                      entry.role === "assistant"
                        ? "bg-[var(--pale)] text-slate-700"
                        : "bg-[var(--dark)] text-white"
                    }`}
                  >
                    {entry.content}
                  </div>
                ))}
              </div>
              <form onSubmit={askTutor} className="mt-4 flex gap-2">
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question…"
                  className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="submit"
                  disabled={thinking || !question.trim()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--dark)] text-white disabled:opacity-35"
                  aria-label="Send question"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
