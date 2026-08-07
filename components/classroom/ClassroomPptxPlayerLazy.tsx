"use client";

import dynamic from "next/dynamic";
import { LoaderCircle } from "lucide-react";
import PptxSlideViewer from "@/components/classroom/PptxSlideViewer";

type Props = {
  deckUrl: string;
  slideIndex: number;
  title: string;
  fallbackImageUrl?: string;
};

function LegacyPptxPlayer(props: Props) {
  return <PptxSlideViewer {...props} />;
}

const ClassroomPptxPlayer = dynamic<Props>(
  () =>
    import("@/components/classroom/ClassroomPptxPlayer").catch(() => ({
      default: LegacyPptxPlayer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#0b1524]">
        <LoaderCircle className="animate-spin text-amber-300" size={28} />
      </div>
    ),
  },
);

export default ClassroomPptxPlayer;
