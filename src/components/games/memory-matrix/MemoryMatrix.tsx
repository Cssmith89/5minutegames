"use client";

import { useState } from "react";
import Round from "./Round";
import type { LevelResult, Phase } from "./types";

// The registry (registry.tsx) renders every native game as
// ComponentType<{ slug: string }> for shape consistency across the
// registry, even though this game has no per-slug state to key off.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function MemoryMatrix(_props: { slug: string }) {
  const [phase, setPhase] = useState<Phase>({ step: "intro" });

  function handleStart() {
    setPhase({ step: "playing" });
  }

  function handleGameOver(result: LevelResult) {
    setPhase({ step: "result", result });
  }

  function handleExit() {
    setPhase({ step: "intro" });
  }

  if (phase.step === "intro") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
        <h2 className="text-xl font-semibold text-neutral-100">Ready?</h2>
        <p className="max-w-sm text-sm text-neutral-400">
          A grid flashes a few lit tiles, then clears &mdash; click the same
          tiles back from memory. Clear a level to grow the grid or the
          number of tiles to remember. One wrong click ends the run, so
          there are no lives here &mdash; just how far you can get.
        </p>
        <button
          type="button"
          onClick={handleStart}
          className="rounded-md bg-accent/20 px-6 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent/30"
        >
          Start
        </button>
      </div>
    );
  }

  if (phase.step === "playing") {
    return <Round onGameOver={handleGameOver} onExit={handleExit} />;
  }

  const { score, levelReached } = phase.result;
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
      <p className="font-mono text-sm text-neutral-500">Wrong tile</p>
      <p className="font-mono text-2xl text-neutral-100">{score} tiles recalled</p>
      <p className="font-mono text-sm text-neutral-500">
        reached level {levelReached}
      </p>
      <button
        type="button"
        onClick={handleStart}
        className="rounded-md bg-accent/20 px-6 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent/30"
      >
        Play again
      </button>
    </div>
  );
}
