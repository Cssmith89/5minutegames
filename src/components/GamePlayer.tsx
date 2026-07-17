"use client";

import { useEffect, useRef, useState } from "react";

interface CloudSaveMessage {
  type: string;
  game?: string;
  slot?: number;
  data?: unknown;
}

export default function GamePlayer({
  title,
  slug,
  buildPath,
  loggedIn,
}: {
  title: string;
  slug: string;
  buildPath: string;
  loggedIn: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [started, setStarted] = useState(false);

  function handleFullscreen() {
    wrapperRef.current?.requestFullscreen?.();
  }

  // Bridges the game's own save system to this account, via postMessage --
  // see CloudSaveBridge (Godot) / the export preset's head_include script for
  // the other half. Generic across every game: the game just needs to speak
  // this same "5mg:*" protocol, keyed by its own slug.
  useEffect(() => {
    if (!started) return;

    async function handleMessage(event: MessageEvent<CloudSaveMessage>) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const message = event.data;
      if (!message || typeof message.type !== "string") return;

      if (message.type === "5mg:request-saves") {
        if (!loggedIn) return;
        const res = await fetch(`/api/saves/${slug}`);
        if (!res.ok) return;
        const { saves } = await res.json();
        iframeRef.current?.contentWindow?.postMessage(
          { type: "5mg:saves", saves },
          window.location.origin,
        );
        return;
      }

      if (message.type === "5mg:save") {
        if (!loggedIn) return;
        await fetch(`/api/saves/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot: message.slot, data: message.data }),
        });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [started, slug, loggedIn]);

  return (
    <div className="w-full">
      <div
        ref={wrapperRef}
        className="relative aspect-video w-full overflow-hidden rounded-lg border border-neutral-800 bg-black"
      >
        {started ? (
          <iframe
            ref={iframeRef}
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
