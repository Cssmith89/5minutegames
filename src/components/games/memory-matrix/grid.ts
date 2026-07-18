import {
  MATRIX_MAX_GRID_SIZE,
  MATRIX_MAX_LIT_COUNT,
  MATRIX_START_GRID_SIZE,
  MATRIX_START_LIT_COUNT,
} from "./config";

export interface LevelParams {
  gridSize: number;
  litCount: number;
}

// Alternates which axis grows on level-up (grid size on even levels, lit
// count on odd ones) rather than ramping both at once, and always leaves at
// least one unlit tile so recall never becomes trivial once the grid caps
// out.
export function getLevelParams(level: number): LevelParams {
  const gridSize = Math.min(
    MATRIX_START_GRID_SIZE + Math.floor(level / 2),
    MATRIX_MAX_GRID_SIZE,
  );
  const litCount = Math.min(
    MATRIX_START_LIT_COUNT + Math.ceil(level / 2),
    MATRIX_MAX_LIT_COUNT,
    gridSize * gridSize - 1,
  );
  return { gridSize, litCount };
}

// Picks `litCount` distinct tile indices out of gridSize*gridSize via a
// partial Fisher-Yates shuffle — litCount is always well under the total
// tile count (getLevelParams caps it short of gridSize*gridSize), so this
// never needs rejection sampling.
export function generateLitTiles(
  rng: () => number,
  gridSize: number,
  litCount: number,
): Set<number> {
  const total = gridSize * gridSize;
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = 0; i < litCount; i++) {
    const j = i + Math.floor(rng() * (total - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return new Set(indices.slice(0, litCount));
}
