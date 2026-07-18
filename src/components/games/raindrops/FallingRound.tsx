"use client";

import { useEffect, useRef, useState } from "react";
import { randomFloat } from "@/lib/dailySeed";
import LivesIndicator from "../shared/LivesIndicator";
import {
  RAIN_ADD_SHAPE_MIXED_SCORE,
  RAIN_CLEAN_STREAK_FOR_LIFE,
  RAIN_EASY_STAGE_MAX_CONCURRENT,
  RAIN_EASY_STAGE_SPAWN_MS,
  RAIN_EASY_STAGE_TAPER_SCORE_SPAN,
  RAIN_LIFE_GAIN_BLINK_MS,
  RAIN_MAX_CONCURRENT_CEILING,
  RAIN_MAX_CONCURRENT_SCORE_PER_STEP,
  RAIN_MAX_CONCURRENT_START,
  RAIN_MAX_LIVES,
  RAIN_PACE_RECOVERY_SCORE_SPAN,
  RAIN_RESOLVED_FADE_MS,
  RAIN_SPAWN_MS_FLOOR,
  RAIN_SPAWN_MS_PER_POINT,
  RAIN_SPAWN_MS_START,
  RAIN_STARTING_LIVES,
} from "./config";
import { computeFallMs, generateChoices, generateEquation } from "./equations";
import type { DropSpec, EndlessResult } from "./types";

export default function FallingRound({
  onGameOver,
  onExit,
}: {
  onGameOver: (result: EndlessResult) => void;
  onExit: () => void;
}) {
  const [drops, setDrops] = useState<DropSpec[]>([]);
  const [mountedIds, setMountedIds] = useState<Set<number>>(new Set());
  const [lives, setLives] = useState(RAIN_STARTING_LIVES);
  const [score, setScore] = useState(0);
  const [lifeGainBlink, setLifeGainBlink] = useState(false);

  const gameOverRef = useRef(false);
  const livesRef = useRef(RAIN_STARTING_LIVES);
  const scoreRef = useRef(0);
  const nextIdRef = useRef(0);
  // Each drop's expiry timeout, keyed by drop id, so an early resolution
  // (a choice click) can cancel it — otherwise the original expiry timeout
  // still fires later and calls loseLife() a second time even though the
  // drop was already answered.
  const expiryTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Correct answers in a row, across drops — reaching the threshold refunds
  // a life (up to the cap) and resets back to zero, so it can happen
  // repeatedly over the course of a run. Mirrors reflex-test's
  // cleanStreakRef.
  const cleanStreakRef = useRef(0);
  const lifeGainBlinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // How many drops currently have status "falling" (unresolved) — read
  // synchronously by the spawn scheduler to enforce the concurrency cap.
  // Incremented on spawn, decremented exactly once per drop when it
  // resolves (expiry-miss or either handleChoice branch); the existing
  // expiry-timeout-cancellation guards those two paths from ever double
  // -firing for the same drop.
  const fallingCountRef = useRef(0);
  // Fixed horizontal "lanes" (RAIN_MAX_CONCURRENT_CEILING of them, always
  // more than the current concurrency cap can ever fill) that concurrently
  // -falling drops claim on spawn and release on resolution -- guarantees
  // two drops falling at the same time never share near-enough horizontal
  // space to visually cross paths, regardless of how their fall speeds
  // differ (multiplication/double-digit problems fall slower than simple
  // ones). Replaces plain per-spawn random placement, which had no such
  // guarantee and let drops pass through each other.
  const occupiedLanesRef = useRef<Set<number>>(new Set());
  const dropLanesRef = useRef<Map<number, number>>(new Map());

  function releaseLane(id: number) {
    const lane = dropLanesRef.current.get(id);
    if (lane === undefined) return;
    occupiedLanesRef.current.delete(lane);
    dropLanesRef.current.delete(id);
  }

  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    return () => {
      if (lifeGainBlinkTimeoutRef.current) clearTimeout(lifeGainBlinkTimeoutRef.current);
    };
  }, []);

  function loseLife() {
    if (gameOverRef.current) return;
    cleanStreakRef.current = 0;
    setLives((prev) => Math.max(prev - 1, 0));
  }

  function gainLife() {
    if (gameOverRef.current || livesRef.current >= RAIN_MAX_LIVES) return;
    setLives((prev) => Math.min(prev + 1, RAIN_MAX_LIVES));
    setLifeGainBlink(true);
    if (lifeGainBlinkTimeoutRef.current) clearTimeout(lifeGainBlinkTimeoutRef.current);
    lifeGainBlinkTimeoutRef.current = setTimeout(
      () => setLifeGainBlink(false),
      RAIN_LIFE_GAIN_BLINK_MS,
    );
  }

  function registerCorrect() {
    cleanStreakRef.current += 1;
    if (cleanStreakRef.current >= RAIN_CLEAN_STREAK_FOR_LIFE) {
      cleanStreakRef.current = 0;
      gainLife();
    }
  }

  function removeDrop(id: number) {
    setDrops((prev) => prev.filter((d) => d.id !== id));
    setMountedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // A self-rescheduling setTimeout chain (not setInterval, so each
  // reschedule reads the current score-driven delay fresh) drives spawning
  // for the whole round — mirrors reflex-test's wave-to-wave chaining, just
  // one continuous chain instead of one effect per wave. Each spawned drop
  // gets its own independent expiry timeout with a fallMs frozen at spawn
  // time; drops don't coordinate with each other, so no shared rAF loop is
  // needed — the falling motion itself is a CSS transition per drop (see
  // render below), the same technique reflex-test already uses for
  // continuous target movement.
  useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const frames: number[] = [];

    // The score-driven ramp values, pulled out as named helpers so both the
    // post-taper branch and the taper's own interpolation (below) can call
    // them without duplicating the formulas.
    function rampSpawnMs(currentScore: number) {
      return Math.max(
        RAIN_SPAWN_MS_FLOOR,
        RAIN_SPAWN_MS_START - currentScore * RAIN_SPAWN_MS_PER_POINT,
      );
    }
    function rampMaxConcurrent(currentScore: number) {
      return Math.min(
        RAIN_MAX_CONCURRENT_CEILING,
        RAIN_MAX_CONCURRENT_START +
          Math.floor(currentScore / RAIN_MAX_CONCURRENT_SCORE_PER_STEP),
      );
    }

    function scheduleSpawn() {
      // Before any mixed/double-digit shape has unlocked, problems are all
      // trivial single-digit pairs — boost to a fast, busy pace instead of
      // the slow start of the normal ramp. Once mixed shapes start
      // appearing (score >= RAIN_ADD_SHAPE_MIXED_SCORE), ease down
      // gradually over RAIN_EASY_STAGE_TAPER_SCORE_SPAN more points so
      // there's no sudden idle gap right as problems start getting harder —
      // then, rather than staying slow, recover back UP to the easy
      // stage's own pace over RAIN_PACE_RECOVERY_SCORE_SPAN more points and
      // hold there permanently. So the shape is: fast, brief dip, back to
      // fast — a tough patch lasts a bounded stretch instead of an
      // open-ended ramp, and difficulty past that point comes from the
      // numbers themselves (bigger operands, harder operations).
      const currentScore = scoreRef.current;
      const taperEnd = RAIN_ADD_SHAPE_MIXED_SCORE + RAIN_EASY_STAGE_TAPER_SCORE_SPAN;
      const recoveryEnd = taperEnd + RAIN_PACE_RECOVERY_SCORE_SPAN;
      // The taper's target and the recovery's starting point are the same
      // fixed "dip bottom" -- whatever the ramp formula gives at taperEnd --
      // evaluated once rather than continuously, since score >= taperEnd no
      // longer drives pacing directly.
      const dipSpawnMs = rampSpawnMs(taperEnd);
      const dipMaxConcurrent = rampMaxConcurrent(taperEnd);
      let spawnDelay: number;
      let maxConcurrent: number;
      if (currentScore < RAIN_ADD_SHAPE_MIXED_SCORE) {
        spawnDelay = RAIN_EASY_STAGE_SPAWN_MS;
        maxConcurrent = RAIN_EASY_STAGE_MAX_CONCURRENT;
      } else if (currentScore < taperEnd) {
        const t = (currentScore - RAIN_ADD_SHAPE_MIXED_SCORE) / RAIN_EASY_STAGE_TAPER_SCORE_SPAN;
        spawnDelay = Math.round(RAIN_EASY_STAGE_SPAWN_MS + (dipSpawnMs - RAIN_EASY_STAGE_SPAWN_MS) * t);
        maxConcurrent = Math.round(
          RAIN_EASY_STAGE_MAX_CONCURRENT + (dipMaxConcurrent - RAIN_EASY_STAGE_MAX_CONCURRENT) * t,
        );
      } else if (currentScore < recoveryEnd) {
        const t = (currentScore - taperEnd) / RAIN_PACE_RECOVERY_SCORE_SPAN;
        spawnDelay = Math.round(dipSpawnMs + (RAIN_EASY_STAGE_SPAWN_MS - dipSpawnMs) * t);
        maxConcurrent = Math.round(
          dipMaxConcurrent + (RAIN_EASY_STAGE_MAX_CONCURRENT - dipMaxConcurrent) * t,
        );
      } else {
        spawnDelay = RAIN_EASY_STAGE_SPAWN_MS;
        maxConcurrent = RAIN_EASY_STAGE_MAX_CONCURRENT;
      }
      timeouts.push(
        setTimeout(() => {
          if (cancelled || gameOverRef.current) return;
          // Only spawn if under the current concurrency cap — a spawn that
          // would exceed it just waits for the next tick (and for a slot to
          // free up) rather than bursting once room opens up, which is what
          // gives real spacing between drops on screen.
          if (fallingCountRef.current < maxConcurrent) {
            spawnDrop();
          }
          scheduleSpawn();
        }, spawnDelay),
      );
    }

    function spawnDrop() {
      const { text, answer, operation } = generateEquation(Math.random, scoreRef.current);
      const fallMs = computeFallMs(operation, answer);
      const choices = generateChoices(Math.random, answer);
      const id = nextIdRef.current++;
      let lane = 0;
      for (let i = 0; i < RAIN_MAX_CONCURRENT_CEILING; i++) {
        if (!occupiedLanesRef.current.has(i)) {
          lane = i;
          break;
        }
      }
      occupiedLanesRef.current.add(lane);
      dropLanesRef.current.set(id, lane);
      // Evenly spaced lane centers across the 8-88% usable width, with a
      // little jitter within each lane so drops don't look robotically
      // gridded -- the jitter range is small enough relative to the lane
      // width that adjacent lanes still can't touch.
      const laneWidth = (88 - 8) / (RAIN_MAX_CONCURRENT_CEILING - 1);
      const laneCenter = 8 + lane * laneWidth;
      const leftPct = laneCenter + randomFloat(Math.random, -laneWidth / 4, laneWidth / 4);
      const drop: DropSpec = { id, text, answer, choices, fallMs, leftPct, status: "falling" };

      fallingCountRef.current += 1;
      setDrops((prev) => [...prev, drop]);
      // Double rAF, not single: a single rAF can fire before the browser has
      // actually painted the drop's initial -8% position, in which case the
      // very first painted style is already the 92% end position (nothing to
      // transition from) and the drop just appears at the bottom instead of
      // visibly falling. Nesting a second rAF inside the first defers the
      // flip to the frame after paint, so the starting position is always
      // rendered first.
      const frame1 = requestAnimationFrame(() => {
        const frame2 = requestAnimationFrame(() => {
          setMountedIds((prev) => new Set(prev).add(id));
        });
        frames.push(frame2);
      });
      frames.push(frame1);

      const expiryTimeout = setTimeout(() => {
        if (cancelled || gameOverRef.current) return;
        expiryTimeoutsRef.current.delete(id);
        fallingCountRef.current -= 1;
        releaseLane(id);
        setDrops((prev) =>
          prev.map((d) =>
            d.id === id && d.status === "falling" ? { ...d, status: "missed" } : d,
          ),
        );
        loseLife();
        timeouts.push(setTimeout(() => removeDrop(id), RAIN_RESOLVED_FADE_MS));
      }, fallMs);
      timeouts.push(expiryTimeout);
      expiryTimeoutsRef.current.set(id, expiryTimeout);
    }

    scheduleSpawn();

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
      frames.forEach((frameId) => cancelAnimationFrame(frameId));
    };
  }, []);

  // Ends the run the instant lives hit zero, regardless of what's still
  // falling.
  useEffect(() => {
    if (lives <= 0 && !gameOverRef.current) {
      gameOverRef.current = true;
      onGameOver({ score });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once, guarded by gameOverRef
  }, [lives]);

  // The always-focused input always answers the oldest still-falling drop —
  // derived each render rather than tracked as separate state, so it can
  // never drift from the drops array itself.
  const activeDrop = drops.find((d) => d.status === "falling") ?? null;

  function handleChoice(drop: DropSpec, choice: number) {
    if (gameOverRef.current || drop.id !== activeDrop?.id) return;

    // The expiry timeout map doubles as an "already resolved" guard: it's
    // only present while a drop is genuinely still falling, so a rapid
    // double-click (two click events landing before React re-renders and
    // activeDrop stops matching this drop) bails out here instead of
    // resolving — and decrementing fallingCountRef — twice for one drop.
    const expiryTimeout = expiryTimeoutsRef.current.get(drop.id);
    if (!expiryTimeout) return;
    clearTimeout(expiryTimeout);
    expiryTimeoutsRef.current.delete(drop.id);
    fallingCountRef.current -= 1;
    releaseLane(drop.id);

    if (choice === drop.answer) {
      setDrops((prev) => prev.map((d) => (d.id === drop.id ? { ...d, status: "correct" } : d)));
      setScore((s) => s + 1);
      registerCorrect();
    } else {
      // A wrong pick is judged instantly, same as a drop reaching the
      // bottom unanswered — reuses the same "missed" red-flash styling.
      setDrops((prev) => prev.map((d) => (d.id === drop.id ? { ...d, status: "missed" } : d)));
      loseLife();
    }
    setTimeout(() => removeDrop(drop.id), RAIN_RESOLVED_FADE_MS);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-sm">
        <span className="text-neutral-400">
          Score <span className="text-neutral-100">{score}</span>
        </span>
        <div className="flex items-center gap-3">
          <LivesIndicator lives={lives} maxLives={RAIN_MAX_LIVES} blink={lifeGainBlink} />
          <button
            type="button"
            onClick={onExit}
            className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100"
          >
            Exit
          </button>
        </div>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 [container-type:inline-size]">
        {drops.map((drop) => {
          const isActive = activeDrop?.id === drop.id;
          const mounted = mountedIds.has(drop.id);
          const resolved = drop.status !== "falling";
          return (
            <div
              key={drop.id}
              className={`absolute -translate-x-1/2 whitespace-nowrap rounded-md border px-3 py-1 font-mono text-sm sm:text-base ${
                drop.status === "correct"
                  ? "border-green-400 bg-green-500/20 text-green-300"
                  : drop.status === "missed"
                    ? "border-red-500 bg-red-500/20 text-red-300"
                    : isActive
                      ? "border-white bg-neutral-800 text-neutral-100 shadow-[0_0_16px_rgba(255,255,255,0.4)]"
                      : "border-neutral-700 bg-neutral-800/70 text-neutral-400"
              }`}
              style={{
                left: `${drop.leftPct}%`,
                top: mounted ? "92%" : "-8%",
                opacity: resolved ? 0 : 1,
                transition: `top ${drop.fallMs}ms linear, opacity ${RAIN_RESOLVED_FADE_MS}ms ease-out`,
              }}
            >
              {drop.text}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => {
          const choice = activeDrop?.choices[i];
          return (
            <button
              key={i}
              type="button"
              disabled={!activeDrop}
              onClick={() => activeDrop && choice !== undefined && handleChoice(activeDrop, choice)}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-4 py-3 font-mono text-lg text-neutral-100 transition-colors hover:enabled:border-accent disabled:opacity-40"
            >
              {choice ?? "–"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
