"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { SlideTransition } from "@/lib/classroom-lineup";

const HIDDEN_CLASSES: Record<SlideTransition, string> = {
  none: "",
  fade: "opacity-0",
  "slide-left": "opacity-0 translate-x-10",
  "slide-up": "opacity-0 translate-y-8",
  zoom: "opacity-0 scale-[0.92]",
  flip: "opacity-0 [transform:perspective(1200px)_rotateY(14deg)]",
};

const VISIBLE_CLASSES =
  "opacity-100 translate-x-0 translate-y-0 scale-100 [transform:perspective(1200px)_rotateY(0deg)]";

export default function SlideStageTransition({
  stageKey,
  transition = "fade",
  children,
}: {
  stageKey: string;
  transition?: SlideTransition;
  children: ReactNode;
}) {
  const [activeKey, setActiveKey] = useState(stageKey);
  const [visible, setVisible] = useState(true);

  const instant = transition === "none";

  useEffect(() => {
    if (stageKey === activeKey) return;
    if (instant) {
      setActiveKey(stageKey);
      setVisible(true);
      return;
    }
    setVisible(false);
    const timeout = window.setTimeout(() => {
      setActiveKey(stageKey);
      setVisible(true);
    }, 280);
    return () => window.clearTimeout(timeout);
  }, [stageKey, activeKey, instant]);

  const showCurrent = activeKey === stageKey;

  return (
    <div
      className={`h-full w-full ${
        instant ? "" : "transition-all duration-500 ease-out"
      } ${visible ? VISIBLE_CLASSES : HIDDEN_CLASSES[transition] || HIDDEN_CLASSES.fade}`}
    >
      {showCurrent ? children : null}
    </div>
  );
}
