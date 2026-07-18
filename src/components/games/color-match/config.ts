export type ColorName = "red" | "blue" | "green" | "yellow" | "purple" | "orange";

export const COLOR_NAMES: readonly ColorName[] = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
];

export const COLOR_LABELS: Record<ColorName, string> = {
  red: "RED",
  blue: "BLUE",
  green: "GREEN",
  yellow: "YELLOW",
  purple: "PURPLE",
  orange: "ORANGE",
};

// A static lookup, not string interpolation — Tailwind's build-time class
// scanner only picks up class names that appear literally in source, so
// building `text-${name}-500` at runtime would silently render unstyled
// text instead of colored ink.
export const COLOR_CLASSES: Record<ColorName, string> = {
  red: "text-red-500",
  blue: "text-blue-500",
  green: "text-green-500",
  yellow: "text-yellow-400",
  purple: "text-purple-500",
  orange: "text-orange-500",
};

export const COLOR_STARTING_LIVES = 3;

// Every tick shows one word/ink pair for `timeLimit` ms — that duration is
// both the visible countdown and the judging deadline. A growing
// correct-answer streak shrinks it, capped at the floor.
export const COLOR_TIME_LIMIT_START_MS = 2500;
export const COLOR_TIME_LIMIT_FLOOR_MS = 800;
export const COLOR_TIME_LIMIT_DECREMENT_MS = 70;

// How long a resolved pair's green/red feedback stays visible before the
// next tick begins.
export const COLOR_RESOLVED_FADE_MS = 350;
