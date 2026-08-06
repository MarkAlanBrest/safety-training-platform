"use client";

import { useState } from "react";
import { CheckCircle2, PlayCircle } from "lucide-react";

export default function ClassroomVideoSlide({
  headline,
  prompt,
  videoUrl,
  onComplete,
}: {
  headline: string;
  prompt: string;
  videoUrl: string;
  onComplete?: () => void;
}) {
  const [finished, setFinished] = useState(false);

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 px-5 py-5 text-white lg:px-8">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
        <div className="mb-4 shrink-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-amber-300">
            <PlayCircle size={16} /> Video
          </p>
          <h2 className="mt-2 text-2xl font-bold">{headline}</h2>
          {prompt ? <p className="mt-1 text-sm text-slate-300">{prompt}</p> : null}
        </div>

        <video
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          onPlay={() => setFinished(false)}
          onEnded={() => setFinished(true)}
          className="min-h-0 w-full flex-1 rounded-2xl bg-black object-contain shadow-2xl"
        >
          Your browser does not support this video.
        </video>

        <div className="mt-4 flex min-h-10 shrink-0 justify-end">
          {finished ? (
            <button
              type="button"
              onClick={() => onComplete?.()}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white"
            >
              <CheckCircle2 size={17} /> Continue lesson
            </button>
          ) : (
            <p className="self-center text-xs font-semibold text-slate-400">
              Watch the video to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
