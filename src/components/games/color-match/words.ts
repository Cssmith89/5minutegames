import { COLOR_NAMES, type ColorName } from "./config";

export interface WordTick {
  /** The color word's meaning. */
  word: ColorName;
  /** The ink color it's actually rendered in. */
  ink: ColorName;
  /** Ground truth: whether ink matches the word's meaning. */
  matches: boolean;
}

// Decides match/no-match first (roughly 50/50), then either renders the
// word in its own color or in a different one drawn from the pool — so
// `matches` is authoritative and the round never has to re-derive it by
// comparing word/ink itself.
export function pickNextPair(
  rng: () => number,
  pool: readonly ColorName[] = COLOR_NAMES,
): WordTick {
  const word = pool[Math.floor(rng() * pool.length)];

  if (rng() < 0.5) {
    return { word, ink: word, matches: true };
  }

  let ink = word;
  while (ink === word) {
    ink = pool[Math.floor(rng() * pool.length)];
  }
  return { word, ink, matches: false };
}
