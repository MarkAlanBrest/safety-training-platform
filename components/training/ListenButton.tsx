"use client";

import { useRef, useState } from "react";
import { Headphones, Pause, Play } from "lucide-react";

export default function ListenButton({ text }: { text: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");

  async function toggle() {
    if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }
    if (audioRef.current && urlRef.current) {
      await audioRef.current.play();
      setState("playing");
      return;
    }
    setState("loading");
    try {
      const response = await fetch("/api/mason/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("Audio unavailable");
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      urlRef.current = url;
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      await audio.play();
      setState("playing");
    } catch {
      setState("idle");
    }
  }

  if (!text.trim()) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--pale)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-white"
    >
      {state === "playing" ? (
        <Pause size={15} className="text-[var(--accent)]" />
      ) : state === "loading" ? (
        <Headphones size={15} className="text-[var(--accent)]" />
      ) : (
        <Play size={15} className="text-[var(--accent)]" />
      )}
      {state === "playing"
        ? "Pause narration"
        : state === "loading"
          ? "Preparing audio…"
          : "Listen"}
    </button>
  );
}
