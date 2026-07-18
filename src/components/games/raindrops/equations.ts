import { randomInt } from "@/lib/dailySeed";
import {
  RAIN_ADD_SHAPE_DOUBLE_SCORE,
  RAIN_ADD_SHAPE_MIXED_SCORE,
  RAIN_DOUBLE_DIGIT_MAX,
  RAIN_DOUBLE_DIGIT_MIN,
  RAIN_FALL_MS_ADD_BASE,
  RAIN_FALL_MS_CEILING,
  RAIN_FALL_MS_MULTIPLY_BASE,
  RAIN_FALL_MS_PER_DIGIT,
  RAIN_FALL_MS_SUBTRACT_BASE,
  RAIN_MULTIPLY_MAX_CEILING,
  RAIN_MULTIPLY_MAX_PER_POINT_DIVISOR,
  RAIN_MULTIPLY_MAX_START,
  RAIN_MULTIPLY_MIN_CEILING,
  RAIN_MULTIPLY_MIN_PER_POINT_DIVISOR,
  RAIN_MULTIPLY_MIN_START,
  RAIN_SINGLE_DIGIT_MAX,
  RAIN_SUBTRACT_SHAPE_DOUBLE_OFFSET,
  RAIN_SUBTRACT_SHAPE_MIXED_OFFSET,
  RAIN_TIER_MULTIPLICATION_SCORE,
  RAIN_TIER_SUBTRACTION_SCORE,
} from "./config";

export type Operation = "add" | "subtract" | "multiply";

export interface Equation {
  text: string;
  answer: number;
  operation: Operation;
}

// Digit "shape" of the two operands — single+single, single+double, or
// double+double. Each unlocks at its own score threshold and, once
// unlocked, stays in the pool alongside earlier shapes (same growing-pool/
// uniform-pick pattern as getTierOperations below), so "mixed" and
// "double-double" problems phase in gradually rather than the operand range
// itself smoothly growing.
type Shape = "single-single" | "mixed" | "double-double";

function getAddShapes(score: number): Shape[] {
  const shapes: Shape[] = ["single-single"];
  if (score >= RAIN_ADD_SHAPE_MIXED_SCORE) shapes.push("mixed");
  if (score >= RAIN_ADD_SHAPE_DOUBLE_SCORE) shapes.push("double-double");
  return shapes;
}

// Measured from subtraction's own unlock score (scoreSinceUnlock), not raw
// score — same "ramp from its own baseline" principle multiplication's
// operand growth already uses, so subtraction's shapes start easy the
// moment subtraction itself appears rather than already being scaled to
// global difficulty.
function getSubtractShapes(scoreSinceUnlock: number): Shape[] {
  const shapes: Shape[] = ["single-single"];
  if (scoreSinceUnlock >= RAIN_SUBTRACT_SHAPE_MIXED_OFFSET) shapes.push("mixed");
  if (scoreSinceUnlock >= RAIN_SUBTRACT_SHAPE_DOUBLE_OFFSET) shapes.push("double-double");
  return shapes;
}

// Which operations are unlocked at a given score — tiers stack, so this
// returns the whole currently-available pool rather than a single operation.
export function getTierOperations(score: number): Operation[] {
  const ops: Operation[] = ["add"];
  if (score >= RAIN_TIER_SUBTRACTION_SCORE) ops.push("subtract");
  if (score >= RAIN_TIER_MULTIPLICATION_SCORE) ops.push("multiply");
  return ops;
}

export function generateEquation(rng: () => number, score: number): Equation {
  const ops = getTierOperations(score);
  const op = ops[Math.floor(rng() * ops.length)];

  if (op === "subtract") {
    const shapes = getSubtractShapes(Math.max(score - RAIN_TIER_SUBTRACTION_SCORE, 0));
    const shape = shapes[Math.floor(rng() * shapes.length)];

    // Keep results non-negative — b is always drawn from a range that can't
    // exceed a, rather than independently.
    let a: number;
    let b: number;
    if (shape === "single-single") {
      a = randomInt(rng, 1, RAIN_SINGLE_DIGIT_MAX);
      b = randomInt(rng, 0, a);
    } else if (shape === "mixed") {
      // The natural analog of "x + xx" for a non-commutative op is
      // "xx - x" (double-digit minuend, single-digit subtrahend) — "x - xx"
      // would almost always be negative, so isn't offered.
      a = randomInt(rng, RAIN_DOUBLE_DIGIT_MIN, RAIN_DOUBLE_DIGIT_MAX);
      b = randomInt(rng, 0, RAIN_SINGLE_DIGIT_MAX);
    } else {
      a = randomInt(rng, RAIN_DOUBLE_DIGIT_MIN, RAIN_DOUBLE_DIGIT_MAX);
      b = randomInt(rng, RAIN_DOUBLE_DIGIT_MIN, a);
    }
    return { text: `${a} - ${b}`, answer: a - b, operation: op };
  }

  if (op === "multiply") {
    const difficulty = Math.max(score - RAIN_TIER_MULTIPLICATION_SCORE, 0);
    const aMin = Math.min(
      RAIN_MULTIPLY_MIN_CEILING,
      RAIN_MULTIPLY_MIN_START + Math.floor(difficulty / RAIN_MULTIPLY_MIN_PER_POINT_DIVISOR),
    );
    const aMax = Math.max(
      aMin,
      Math.min(
        RAIN_MULTIPLY_MAX_CEILING,
        RAIN_MULTIPLY_MAX_START + Math.floor(difficulty / RAIN_MULTIPLY_MAX_PER_POINT_DIVISOR),
      ),
    );
    const a = randomInt(rng, aMin, aMax);
    const b = randomInt(rng, aMin, aMax);
    return { text: `${a} × ${b}`, answer: a * b, operation: op };
  }

  const shapes = getAddShapes(score);
  const shape = shapes[Math.floor(rng() * shapes.length)];

  let a: number;
  let b: number;
  if (shape === "single-single") {
    a = randomInt(rng, 1, RAIN_SINGLE_DIGIT_MAX);
    b = randomInt(rng, 1, RAIN_SINGLE_DIGIT_MAX);
  } else if (shape === "mixed") {
    const single = randomInt(rng, 1, RAIN_SINGLE_DIGIT_MAX);
    // Cap the double operand so x + xx always stays a 2-digit answer --
    // otherwise sums can hit 100+, which is too hard to solve this early.
    const double = randomInt(rng, RAIN_DOUBLE_DIGIT_MIN, 99 - single);
    // Coin-flip which side each lands on, so it isn't always "small + big"
    // in the same order.
    [a, b] = rng() < 0.5 ? [single, double] : [double, single];
  } else {
    a = randomInt(rng, RAIN_DOUBLE_DIGIT_MIN, RAIN_DOUBLE_DIGIT_MAX);
    b = randomInt(rng, RAIN_DOUBLE_DIGIT_MIN, RAIN_DOUBLE_DIGIT_MAX);
  }
  return { text: `${a} + ${b}`, answer: a + b, operation: op };
}

// How long a drop should take to fall, driven by the equation's own
// difficulty rather than score: a higher base for operations that are
// inherently harder (multiplication over add/subtract), plus extra time per
// digit in the answer (bigger numbers take longer to work out), capped at a
// ceiling so extreme late-game answers don't produce absurdly slow drops.
export function computeFallMs(operation: Operation, answer: number): number {
  const base =
    operation === "multiply"
      ? RAIN_FALL_MS_MULTIPLY_BASE
      : operation === "subtract"
        ? RAIN_FALL_MS_SUBTRACT_BASE
        : RAIN_FALL_MS_ADD_BASE;
  const extraDigits = Math.max(String(Math.abs(answer)).length - 1, 0);
  return Math.min(RAIN_FALL_MS_CEILING, base + extraDigits * RAIN_FALL_MS_PER_DIGIT);
}

// Builds a shuffled set of `count` answer choices (the correct answer plus
// distractors at answer +/- a small offset), for multiple-choice mode.
// Negative candidates are skipped so displayed choices stay non-negative,
// matching the non-negative-subtraction convention above. The fixed 10-value
// offset range (+/-1..5) always has enough room for the 3 distractors a
// 4-choice set needs, so this is guaranteed to terminate.
export function generateChoices(rng: () => number, answer: number, count = 4): number[] {
  const choices = new Set<number>([answer]);
  while (choices.size < count) {
    const offset = randomInt(rng, 1, 5) * (rng() < 0.5 ? -1 : 1);
    const candidate = answer + offset;
    if (candidate < 0) continue;
    choices.add(candidate);
  }

  const shuffled = Array.from(choices);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
