"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function SlideStageTransition({
  stageKey,
  children,
}: {
  stageKey: string;
  children: ReactNode;
}) {
  const [activeKey, setActiveKey] = useState(stageKey);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (stageKey === activeKey) return;
    setVisible(false);
    const timeout = window.setTimeout(() => {
      setActiveKey(stageKey);
      setVisible(true);
    }, 280);
    return () => window.clearTimeout(timeout);
  }, [stageKey, activeKey]);

  const showCurrent = activeKey === stageKey;

  return (
    <div
      className={`h-full w-full transition-all duration-500 ease-out ${
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-[0.98]"
      }`}
    >
      {showCurrent ? children : null}
    </div>
  );
}
