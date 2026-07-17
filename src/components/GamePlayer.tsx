"use client";

import { useRef, useState } from "react";

export default function GamePlayer({
  title,
  buildPath,
}: {
  title: string;
  buildPath: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  function handleFullscreen() {
    wrapperRef.current?.requestFullscreen?.();
  }

  return (
    <div className="w-full">
      <div
        ref={wrapperRef}
        className="relative aspect-video w-full overflow-hidden rounded-lg border border-neutral-800 bg-black"
      >
        {started ? (
          <iframe
            src={`${buildPath}/index.html`}
            title={title}
            className="h-full w-full"
            allow="fullscreen; autoplay"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-300 transition-colors hover:text-neutral-100"
          >
            <span className="rounded-full bg-accent/20 px-6 py-3 font-mono text-sm text-accent">
              Click to play
            </span>
            <span className="text-xs text-neutral-500">
              First load may take 10-30s
            </span>
          </button>
        )}
      </div>
      {started && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleFullscreen}
            className="rounded-md border border-neutral-800 px-3 py-1.5 font-mono text-xs text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-100"
          >
            Fullscreen
          </button>
        </div>
      )}
    </div>
  );
}
