"use client";

export default function SlideImageStage({
  imageUrl,
  title,
}: {
  imageUrl: string;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-[#0b1524] p-2 sm:p-3">
      <div className="relative flex h-full w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title}
          className="max-h-full max-w-full object-contain"
          style={{ imageRendering: "auto" }}
          draggable={false}
          decoding="async"
        />
      </div>
    </div>
  );
}
