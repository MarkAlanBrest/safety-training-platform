"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { SlideTransition } from "@/lib/classroom-lineup";

const HIDDEN_CLASSES: Record<SlideTransition, string> = {
  none: "",
  fade: "opacity-0",
  "slide-left": "opacity-0 translate-x-24",
  "slide-up": "opacity-0 translate-y-16",
  zoom: "opacity-0 scale-[0.92]",
  flip: "opacity-0 [transform:perspective(1200px)_rotateY(14deg)]",
};

const VISIBLE_CLASSES =
  "opacity-100 translate-x-0 translate-y-0 scale-100 [transform:perspective(1200px)_rotateY(0deg)]";

export default function SlideStageTransition({
  transition = "fade",
  children,
}: {
  transition?: SlideTransition;
  children: ReactNode;
}) {
  const instant = transition === "none";
  const [visible, setVisible] = useState(instant);

  useEffect(() => {
    if (instant) return;
    const frame = window.requestAnimationFrame(() => {
      setVisible(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [instant]);

  return (
    <div
      className={`h-full w-full ${
        instant ? "" : "transition-all duration-200 ease-out"
      } ${visible ? VISIBLE_CLASSES : HIDDEN_CLASSES[transition] || HIDDEN_CLASSES.fade}`}
    >
      {children}
    </div>
  );
}
