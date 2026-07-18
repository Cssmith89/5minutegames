"use client";

import { useState } from "react";
import EndlessRound from "./EndlessRound";
import type { EndlessResult, Phase } from "./types";

// The registry (registry.tsx) renders every native game as
// ComponentType<{ slug: string }> for shape consistency across the
// registry, even though this game has no per-slug state to key off.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function SpeedMatch(_props: { slug: string }) {
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
          A symbol appears &mdash; tap Match if it&apos;s the same as the one
          before it, No Match if it isn&apos;t. Answer fast: every correct
          streak speeds things up. You have 3 lives; a wrong answer or a
          missed one costs a life.
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

  const { score, bestStreak } = phase.result;
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
      <p className="font-mono text-sm text-neutral-500">Out of lives</p>
      <p className="font-mono text-2xl text-neutral-100">{score} correct</p>
      <p className="font-mono text-sm text-neutral-500">
        best streak {bestStreak}
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
