"use client";

import dynamic from "next/dynamic";
import { LoaderCircle } from "lucide-react";

const ClassroomPptxPlayer = dynamic(() => import("@/components/classroom/ClassroomPptxPlayer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0b1524]">
      <LoaderCircle className="animate-spin text-amber-300" size={28} />
    </div>
  ),
});

export default ClassroomPptxPlayer;
