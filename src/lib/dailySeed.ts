// Deterministic per-day RNG shared by daily puzzle games, so every player
// sees the identical puzzle for a given UTC day (Wordle-style).

export function getUtcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getDayNumber(date: Date = new Date(), epoch = "2026-07-17"): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const epochMs = Date.parse(`${epoch}T00:00:00Z`);
  const todayMs = Date.parse(`${getUtcDateString(date)}T00:00:00Z`);
  return Math.floor((todayMs - epochMs) / msPerDay) + 1;
}

export function hashStringToSeed(input: string): number {
  // FNV-1a
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDailyRng(slug: string, date: Date = new Date()): () => number {
  const seed = hashStringToSeed(`${slug}:${getUtcDateString(date)}`);
  return mulberry32(seed);
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randomFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}
