"use client";

import { useState } from "react";
import EndlessRound from "./EndlessRound";
import type { EndlessResult, Phase } from "./types";

// The registry (registry.tsx) renders every native game as
// ComponentType<{ slug: string }> — accepted here for that shared shape,
// even though this game no longer has any per-slug state to key off.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ReflexTest(_props: { slug: string }) {
  const [phase, setPhase] = useState<Phase>({ step: "intro" });

  function handleStart() {
    setPhase({ step: "endless" });
  }

  function handleGameOver(result: EndlessResult) {
    setPhase({ step: "endless-result", result });
  }

  function handleExit() {
    setPhase({ step: "intro" });
  }

  if (phase.step === "intro") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
        <h2 className="text-xl font-semibold text-neutral-100">Ready?</h2>
        <p className="max-w-sm text-sm text-neutral-400">
          Hit the targets in numeric order as fast as you can. Waves ramp up
          over time &mdash; more targets first, then faster. You start with 3
          lives (up to 5): missing one costs a life at the end of that wave,
          but 5 clean waves in a row earns one back.
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

  if (phase.step === "endless") {
    return <EndlessRound onGameOver={handleGameOver} onExit={handleExit} />;
  }

  const { score, waveReached } = phase.result;
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
      <p className="font-mono text-sm text-neutral-500">Out of lives</p>
      <p className="font-mono text-2xl text-neutral-100">{score} hits</p>
      <p className="font-mono text-sm text-neutral-500">
        reached wave {waveReached}
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
