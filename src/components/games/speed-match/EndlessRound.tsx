"use client";

import { useEffect, useRef, useState } from "react";
import LivesIndicator from "../shared/LivesIndicator";
import {
  SPEED_INTERVAL_DECREMENT_MS,
  SPEED_INTERVAL_FLOOR_MS,
  SPEED_INTERVAL_START_MS,
  SPEED_RESOLVED_FADE_MS,
  SPEED_STARTING_LIVES,
} from "./config";
import { pickNextSymbol } from "./symbols";
import type { EndlessResult } from "./types";

type Feedback = "none" | "correct" | "wrong" | "missed";

// Exposed via a ref (see tickApiRef below) so the Match/No Match click
// handlers can judge the current tick without re-running the effect —
// mirrors reflex-test's waveApiRef.
interface TickApi {
  answer: (yes: boolean) => void;
}

export default function EndlessRound({
  onGameOver,
  onExit,
}: {
  onGameOver: (result: EndlessResult) => void;
  onExit: () => void;
}) {
  const [tickNumber, setTickNumber] = useState(0);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>("none");
  const [lives, setLives] = useState(SPEED_STARTING_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const gameOverRef = useRef(false);
  const tickApiRef = useRef<TickApi | null>(null);
  const livesRef = useRef(SPEED_STARTING_LIVES);
  const streakRef = useRef(0);
  // Carries the previous tick's symbol forward so the next tick's
  // match/no-match draw has something to compare against — local state
  // would work too, but a ref avoids this value ever being part of a
  // render dependency it doesn't need to be.
  const previousSymbolRef = useRef<string | null>(null);

  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);

  function loseLife() {
    if (gameOverRef.current) return;
    setLives((prev) => Math.max(prev - 1, 0));
  }

  // Shows one symbol, judges it (by click or timeout), flashes feedback,
  // then advances to the next tick — all bookkeeping for "has this tick
  // already been resolved" lives as a local `resolved` flag closed over by
  // this single effect invocation, so a stray late timeout from a previous
  // tick can never resolve the current one.
  useEffect(() => {
    if (gameOverRef.current) return;
    const interval = Math.max(
      SPEED_INTERVAL_FLOOR_MS,
      SPEED_INTERVAL_START_MS - streakRef.current * SPEED_INTERVAL_DECREMENT_MS,
    );
    const { symbol: nextSymbol, matches } = pickNextSymbol(
      Math.random,
      previousSymbolRef.current,
    );
    previousSymbolRef.current = nextSymbol;

    setSymbol(nextSymbol);
    setFeedback("none");

    let resolved = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    function judge(answeredYes: boolean | null) {
      if (resolved || gameOverRef.current) return;
      resolved = true;

      const correct = answeredYes !== null && answeredYes === matches;
      if (correct) {
        setFeedback("correct");
        setScore((s) => s + 1);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      } else {
        setFeedback(answeredYes === null ? "missed" : "wrong");
        setStreak(0);
        loseLife();
      }

      timeouts.push(
        setTimeout(() => {
          if (!gameOverRef.current) setTickNumber((t) => t + 1);
        }, SPEED_RESOLVED_FADE_MS),
      );
    }

    timeouts.push(setTimeout(() => judge(null), interval));

    tickApiRef.current = {
      answer(yes: boolean) {
        judge(yes);
      },
    };

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [tickNumber]);

  // Ends the run the instant lives hit zero.
  useEffect(() => {
    if (lives <= 0 && !gameOverRef.current) {
      gameOverRef.current = true;
      onGameOver({ score, bestStreak });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once, guarded by gameOverRef
  }, [lives]);

  function handleAnswer(yes: boolean) {
    if (gameOverRef.current) return;
    tickApiRef.current?.answer(yes);
  }

  const ringClass =
    feedback === "correct"
      ? "ring-4 ring-green-400 shadow-[0_0_22px_rgba(74,222,128,0.9)]"
      : feedback === "wrong" || feedback === "missed"
        ? "ring-4 ring-red-500 shadow-[0_0_22px_rgba(239,68,68,0.9)]"
        : "ring-4 ring-neutral-700";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-sm">
        <div className="flex gap-4">
          <span className="text-neutral-400">
            Score <span className="text-neutral-100">{score}</span>
          </span>
          <span className="text-neutral-400">
            Streak <span className="text-neutral-100">{streak}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LivesIndicator lives={lives} maxLives={SPEED_STARTING_LIVES} />
          <button
            type="button"
            onClick={onExit}
            className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100"
          >
            Exit
          </button>
        </div>
      </div>

      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 [container-type:inline-size]">
        <div
          className={`flex items-center justify-center rounded-full bg-neutral-950 transition-shadow duration-150 ${ringClass}`}
          style={{ width: "40cqw", aspectRatio: "1 / 1", maxWidth: "220px" }}
        >
          <span className="font-mono text-6xl text-neutral-100 sm:text-7xl">
            {symbol}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleAnswer(true)}
          className="rounded-md bg-accent/20 px-4 py-3 font-mono text-sm text-accent transition-colors hover:bg-accent/30"
        >
          Match
        </button>
        <button
          type="button"
          onClick={() => handleAnswer(false)}
          className="rounded-md border border-neutral-700 px-4 py-3 font-mono text-sm text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
        >
          No Match
        </button>
      </div>
    </div>
  );
}
