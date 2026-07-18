import { SYMBOL_POOL } from "./config";

export interface SymbolTick {
  symbol: string;
  /** Ground truth: whether this symbol matches the one before it. */
  matches: boolean;
}

// Decides match/no-match first (roughly 50/50), then either repeats the
// previous symbol or draws a different one from the pool — so `matches` is
// authoritative and the round never has to re-derive it by comparing
// strings itself.
export function pickNextSymbol(
  rng: () => number,
  previousSymbol: string | null,
  pool: readonly string[] = SYMBOL_POOL,
): SymbolTick {
  if (previousSymbol === null) {
    // First tick of a round has nothing to match against yet.
    return { symbol: pool[Math.floor(rng() * pool.length)], matches: false };
  }

  if (rng() < 0.5) {
    return { symbol: previousSymbol, matches: true };
  }

  let symbol = previousSymbol;
  while (symbol === previousSymbol) {
    symbol = pool[Math.floor(rng() * pool.length)];
  }
  return { symbol, matches: false };
}
