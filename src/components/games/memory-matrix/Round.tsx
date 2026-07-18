"use client";

import { useEffect, useRef, useState } from "react";
import { MATRIX_REVEAL_MS, MATRIX_STUDY_MS } from "./config";
import { generateLitTiles, getLevelParams } from "./grid";
import type { LevelResult } from "./types";

// Owned locally rather than folded into the top-level Phase — same
// principle as reflex-test scoping per-target status inside its "endless"
// phase without polluting the top-level union, just a coarser 3-way
// subphase here instead of a per-entity array.
type Subphase = "studying" | "input" | "reveal";

export default function Round({
  onGameOver,
  onExit,
}: {
  onGameOver: (result: LevelResult) => void;
  onExit: () => void;
}) {
  const [level, setLevel] = useState(0);
  const [subphase, setSubphase] = useState<Subphase>("studying");
  const [gridSize, setGridSize] = useState(0);
  const [litTiles, setLitTiles] = useState<Set<number>>(new Set());
  const [clicked, setClicked] = useState<Set<number>>(new Set());
  const [wrongTile, setWrongTile] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const gameOverRef = useRef(false);
  // Ground truth for judging clicks — set in lockstep with the litTiles
  // state below inside the same effect, so it's always in sync with what's
  // rendered by the time input opens.
  const answerRef = useRef<Set<number>>(new Set());

  // Generates one level's lit-tile set, shows it for the study window, then
  // opens input. Timeout cleanup mirrors reflex-test's per-round discipline.
  useEffect(() => {
    if (gameOverRef.current) return;
    const { gridSize: size, litCount } = getLevelParams(level);
    const answer = generateLitTiles(Math.random, size, litCount);
    answerRef.current = answer;

    setGridSize(size);
    setLitTiles(answer);
    setClicked(new Set());
    setWrongTile(null);
    setSubphase("studying");

    const timeout = setTimeout(() => {
      if (!gameOverRef.current) setSubphase("input");
    }, MATRIX_STUDY_MS);

    return () => clearTimeout(timeout);
  }, [level]);

  function handleTileClick(index: number) {
    if (gameOverRef.current || subphase !== "input") return;
    if (clicked.has(index)) return;

    if (!answerRef.current.has(index)) {
      gameOverRef.current = true;
      setWrongTile(index);
      setSubphase("reveal");
      setTimeout(() => {
        onGameOver({ score, levelReached: level + 1 });
      }, MATRIX_REVEAL_MS);
      return;
    }

    const next = new Set(clicked);
    next.add(index);
    setClicked(next);

    if (next.size >= answerRef.current.size) {
      const litCount = answerRef.current.size;
      setSubphase("reveal");
      setTimeout(() => {
        if (!gameOverRef.current) {
          setScore((s) => s + litCount);
          setLevel((l) => l + 1);
        }
      }, MATRIX_REVEAL_MS);
    }
  }

  const tileCount = gridSize * gridSize;
  const statusText =
    subphase === "studying"
      ? "Memorize the lit tiles..."
      : subphase === "input"
        ? "Click the tiles you remember"
        : wrongTile !== null
          ? "Wrong tile!"
          : "Nice!";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-sm">
        <div className="flex gap-4">
          <span className="text-neutral-400">
            Level <span className="text-neutral-100">{level + 1}</span>
          </span>
          <span className="text-neutral-400">
            Score <span className="text-neutral-100">{score}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100"
        >
          Exit
        </button>
      </div>

      <p className="text-center font-mono text-xs text-neutral-500">{statusText}</p>

      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 p-4 [container-type:inline-size]">
        {/*
          The container only establishes inline-size containment, so cqh
          isn't resolvable here — cqw is. An aspect-video (16/9) box is
          56.25cqw tall, so that's the cap that keeps this square grid from
          overflowing the box's height; a few cqw of margin covers the
          container's own padding.
        */}
        <div
          className="grid w-full max-w-[52cqw] gap-2"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            aspectRatio: "1 / 1",
          }}
        >
          {Array.from({ length: tileCount }, (_, i) => {
            const isLit = litTiles.has(i);
            const isClicked = clicked.has(i);
            const isWrong = wrongTile === i;

            let tileClass = "bg-neutral-800 hover:enabled:bg-neutral-700";
            if (subphase === "studying" && isLit) {
              tileClass = "bg-accent shadow-[0_0_16px_rgba(34,211,238,0.7)]";
            } else if (subphase === "input" && isClicked) {
              tileClass = "bg-green-500";
            } else if (subphase === "reveal") {
              if (isWrong) {
                tileClass = "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.9)]";
              } else if (isLit) {
                tileClass = "bg-green-500";
              }
            }

            return (
              <button
                key={i}
                type="button"
                disabled={subphase !== "input"}
                onClick={() => handleTileClick(i)}
                aria-label={`tile ${i + 1}`}
                className={`aspect-square rounded-md transition-colors duration-150 disabled:cursor-default ${tileClass}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
