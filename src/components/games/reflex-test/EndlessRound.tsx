"use client";

import { useEffect, useRef, useState } from "react";
import {
  AIM_TARGET_SIZE_PCT,
  AIM_WAVE_STAGGER_MS,
  ENDLESS_CLEAN_STREAK_FOR_LIFE,
  ENDLESS_LIFETIME_DROP_PER_WAVE_MS,
  ENDLESS_LIFETIME_FLOOR_MS,
  ENDLESS_LIFETIME_PER_EXTRA_TARGET_MS,
  ENDLESS_LIFETIME_START_MS,
  ENDLESS_MAX_LIVES,
  ENDLESS_SPEED_RAMP_START_WAVE,
  ENDLESS_STARTING_LIVES,
  ENDLESS_WAVES_PER_SIZE_STEP,
  ENDLESS_WAVE_DELAY_DROP_PER_WAVE_MS,
  ENDLESS_WAVE_DELAY_FLOOR_MS,
  ENDLESS_WAVE_DELAY_START_MS,
  ENDLESS_WAVE_SIZE_MAX,
  ENDLESS_WAVE_SIZE_MIN,
} from "./config";
import { generateWaveTargets, type WaveTargetSpec } from "./targets";
import type { EndlessResult } from "./types";

type TargetStatus = "pending" | "active" | "hit" | "missed";

// How long a resolved bubble's green/red glow stays visible before fading
// out, giving clear feedback on whether a click actually landed.
const RESOLVED_FADE_MS = 350;

// How long the lives indicator's "gained a life" blink lasts.
const LIFE_GAIN_BLINK_MS = 600;

// Concurrency climbs from wave 0. Speed (lifetime/delay) holds at its
// starting values until ENDLESS_SPEED_RAMP_START_WAVE — by then concurrency
// is already near its cap — so difficulty comes from having more targets to
// track well before it comes from needing to be faster. On top of that,
// bigger waves get extra per-target lifetime (same idea as the fixed
// difficulty rounds): a 7-target wave needs more time to clear than a
// 1-target wave at the same point in the ramp.
function getWaveParams(waveNumber: number) {
  const waveSize = Math.min(
    ENDLESS_WAVE_SIZE_MIN + Math.floor(waveNumber / ENDLESS_WAVES_PER_SIZE_STEP),
    ENDLESS_WAVE_SIZE_MAX,
  );
  const speedRampWave = Math.max(waveNumber - ENDLESS_SPEED_RAMP_START_WAVE, 0);
  const baseLifetimeMs = Math.max(
    ENDLESS_LIFETIME_START_MS - speedRampWave * ENDLESS_LIFETIME_DROP_PER_WAVE_MS,
    ENDLESS_LIFETIME_FLOOR_MS,
  );
  const lifetimeMs =
    baseLifetimeMs + (waveSize - 1) * ENDLESS_LIFETIME_PER_EXTRA_TARGET_MS;
  const waveDelayMs = Math.max(
    ENDLESS_WAVE_DELAY_START_MS - speedRampWave * ENDLESS_WAVE_DELAY_DROP_PER_WAVE_MS,
    ENDLESS_WAVE_DELAY_FLOOR_MS,
  );
  return { waveSize, lifetimeMs, waveDelayMs };
}

// Per-wave game logic exposed to click handlers via a ref (see waveApiRef
// below) — kept entirely local to one wave's effect invocation so a wave's
// bookkeeping (resolvedCount, failed flag, ...) can never leak into another
// wave's, even if a stray callback somehow outlived its wave.
interface WaveApi {
  wave: WaveTargetSpec[];
  resolved: boolean[];
  activatedAt: number[];
  hit: (i: number) => void;
}

export default function EndlessRound({
  onGameOver,
  onExit,
}: {
  onGameOver: (result: EndlessResult) => void;
  onExit: () => void;
}) {
  const [waveNumber, setWaveNumber] = useState(0);
  const [currentWave, setCurrentWave] = useState<WaveTargetSpec[]>([]);
  const [statuses, setStatuses] = useState<TargetStatus[]>([]);
  const [animating, setAnimating] = useState<boolean[]>([]);
  const [lives, setLives] = useState(ENDLESS_STARTING_LIVES);
  const [score, setScore] = useState(0);
  const [lifeGainBlink, setLifeGainBlink] = useState(false);

  const gameOverRef = useRef(false);
  const waveApiRef = useRef<WaveApi | null>(null);
  const livesRef = useRef(ENDLESS_STARTING_LIVES);
  // Carries the previous wave's target paths forward so the next wave's
  // positions steer clear of them too — resolved targets keep rendering
  // (fading out) briefly after the wave ends, so without this a freshly
  // spawned target could land right on top of one still fading out.
  const previousWaveRef = useRef<WaveTargetSpec[]>([]);
  // Consecutive waves cleared with zero mistakes — reaching the threshold
  // refunds a life (up to the cap) and resets back to zero, so it can happen
  // repeatedly over the course of a run.
  const cleanStreakRef = useRef(0);
  const lifeGainBlinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

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
    if (gameOverRef.current || livesRef.current >= ENDLESS_MAX_LIVES) return;
    setLives((prev) => Math.min(prev + 1, ENDLESS_MAX_LIVES));
    setLifeGainBlink(true);
    if (lifeGainBlinkTimeoutRef.current) clearTimeout(lifeGainBlinkTimeoutRef.current);
    lifeGainBlinkTimeoutRef.current = setTimeout(
      () => setLifeGainBlink(false),
      LIFE_GAIN_BLINK_MS,
    );
  }

  // Generates one wave (ramped for waveNumber), schedules each target's
  // pop-in and auto-miss timeout, and tracks that wave's own completion —
  // all in variables local to this single effect invocation, so nothing
  // here can be confused with the next wave's state once it starts. Targets
  // can only ever be clicked in ascending order — a click on one that's not
  // next in line does nothing at all (no fail, doesn't resolve it), so the
  // only way a wave fails is a target's own timeout running out before its
  // turn comes. A wave is "failed" the instant that happens (further
  // timeouts in the same wave don't cost anything extra), but the life
  // itself is only taken once, when the wave finishes.
  useEffect(() => {
    if (gameOverRef.current) return;
    const { waveSize, lifetimeMs, waveDelayMs } = getWaveParams(waveNumber);
    const wave = generateWaveTargets(
      Math.random,
      waveSize,
      lifetimeMs,
      previousWaveRef.current,
    );
    previousWaveRef.current = wave;
    const resolved = wave.map(() => false);
    const activatedAt = wave.map(() => 0);
    let resolvedCount = 0;
    let waveFailed = false;
    let advanced = false;

    setCurrentWave(wave);
    setStatuses(wave.map(() => "pending"));
    setAnimating(wave.map(() => false));

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const frames: number[] = [];

    function resolve(i: number, status: "hit" | "missed") {
      if (resolved[i]) return;
      resolved[i] = true;
      setStatuses((prev) => {
        const next = [...prev];
        next[i] = status;
        return next;
      });
      if (status === "hit") setScore((s) => s + 1);

      resolvedCount += 1;
      if (resolvedCount >= wave.length && !advanced) {
        advanced = true;
        if (waveFailed) {
          loseLife();
        } else {
          cleanStreakRef.current += 1;
          if (cleanStreakRef.current >= ENDLESS_CLEAN_STREAK_FOR_LIFE) {
            cleanStreakRef.current = 0;
            gainLife();
          }
        }
        timeouts.push(
          setTimeout(() => {
            if (!gameOverRef.current) setWaveNumber((w) => w + 1);
          }, waveDelayMs),
        );
      }
    }

    function markWaveFailed() {
      if (waveFailed) return;
      waveFailed = true;
    }

    function fail(i: number, status: "hit" | "missed") {
      markWaveFailed();
      resolve(i, status);
    }

    function nextRequiredOrder(): number {
      let min = Infinity;
      wave.forEach((t, idx) => {
        if (!resolved[idx] && t.order < min) min = t.order;
      });
      return min;
    }

    waveApiRef.current = {
      wave,
      resolved,
      activatedAt,
      hit(i: number) {
        if (resolved[i]) return;
        // Out-of-sequence clicks are simply ignored — they can't be clicked
        // at all until it's their turn, so this doesn't fail the wave or
        // resolve anything; the target just keeps waiting for its own turn
        // or its own timeout.
        if (wave[i].order !== nextRequiredOrder()) return;
        resolve(i, "hit");
      },
    };

    wave.forEach((target, i) => {
      const activateDelay = i * AIM_WAVE_STAGGER_MS;

      timeouts.push(
        setTimeout(() => {
          activatedAt[i] = performance.now();
          setStatuses((prev) => {
            const next = [...prev];
            next[i] = "active";
            return next;
          });
          frames.push(
            requestAnimationFrame(() => {
              setAnimating((prev) => {
                const next = [...prev];
                next[i] = true;
                return next;
              });
            }),
          );
        }, activateDelay),
      );

      timeouts.push(
        setTimeout(() => fail(i, "missed"), activateDelay + target.lifetimeMs),
      );
    });

    return () => {
      timeouts.forEach(clearTimeout);
      frames.forEach((id) => cancelAnimationFrame(id));
    };
  }, [waveNumber]);

  // Ends the run the instant lives hit zero, regardless of what's still
  // active in the current wave.
  useEffect(() => {
    if (lives <= 0 && !gameOverRef.current) {
      gameOverRef.current = true;
      onGameOver({ score, waveReached: waveNumber + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once, guarded by gameOverRef
  }, [lives]);

  function handleHit(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (gameOverRef.current) return;
    const i = Number(event.currentTarget.dataset.index);
    waveApiRef.current?.hit(i);
  }

  // Derived from render state (not the effect-local `resolved` array) purely
  // to decide which bubble to visually highlight as "click this one next".
  const nextRequiredOrderForDisplay = currentWave.reduce((min, t, i) => {
    const s = statuses[i];
    if (s === "hit" || s === "missed") return min;
    return t.order < min ? t.order : min;
  }, Infinity);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-sm">
        <div className="flex gap-4">
          <span className="text-neutral-400">
            Wave <span className="text-neutral-100">{waveNumber + 1}</span>
          </span>
          <span className="text-neutral-400">
            Score <span className="text-neutral-100">{score}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-label={`${lives} lives remaining`}
            className={`inline-block transition-transform duration-300 ${
              lifeGainBlink ? "scale-125" : "scale-100"
            }`}
          >
            {Array.from({ length: ENDLESS_MAX_LIVES }, (_, i) => (
              <span
                key={i}
                className={
                  i < lives
                    ? lifeGainBlink
                      ? "text-white transition-colors duration-300"
                      : "text-red-500 transition-colors duration-300"
                    : "text-neutral-700"
                }
              >
                &#9679;{" "}
              </span>
            ))}
          </span>
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
        {currentWave.map((target, i) => {
          const status = statuses[i];
          if (!status || status === "pending") return null;
          const atEnd = animating[i];
          // The lowest order among anything not yet resolved is the one
          // click-order actually requires next — highlighted so it's
          // obvious which bubble to hit first when several are up at once,
          // instead of guessing and getting an out-of-order fail.
          const isNext = status === "active" && target.order === nextRequiredOrderForDisplay;
          // Once resolved, the bubble flashes green (hit) or red (missed)
          // and fades out instead of vanishing instantly, so there's clear
          // feedback on whether that click actually landed.
          const resolved = status === "hit" || status === "missed";
          return (
            <button
              key={`${waveNumber}-${i}`}
              type="button"
              aria-label={`target ${target.order}`}
              data-index={i}
              onPointerDown={handleHit}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent flex items-center justify-center font-mono font-extrabold text-neutral-950 ${
                resolved ? "pointer-events-none" : "hover:scale-105"
              } ${
                status === "hit"
                  ? "ring-4 ring-green-400 shadow-[0_0_22px_rgba(74,222,128,0.9)]"
                  : status === "missed"
                    ? "ring-4 ring-red-500 shadow-[0_0_22px_rgba(239,68,68,0.9)]"
                    : isNext
                      ? "opacity-100 ring-4 ring-white shadow-[0_0_22px_rgba(255,255,255,0.9)]"
                      : "opacity-50 shadow-[0_0_12px_rgba(34,211,238,0.7)]"
              }`}
              style={{
                left: `${atEnd ? target.endXPct : target.xPct}%`,
                top: `${atEnd ? target.endYPct : target.yPct}%`,
                width: `${AIM_TARGET_SIZE_PCT}%`,
                aspectRatio: "1 / 1",
                fontSize: `${AIM_TARGET_SIZE_PCT / 2}cqw`,
                opacity: resolved ? 0 : undefined,
                transition: `left ${target.lifetimeMs * 2}ms linear, top ${target.lifetimeMs * 2}ms linear, transform 150ms, opacity ${resolved ? RESOLVED_FADE_MS : 150}ms ease-out, box-shadow 150ms`,
              }}
            >
              {target.order}
            </button>
          );
        })}
      </div>
    </div>
  );
}
