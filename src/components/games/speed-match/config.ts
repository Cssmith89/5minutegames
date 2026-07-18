// Monochrome Unicode glyphs rather than emoji or an icon library — emoji
// glyph shapes vary across OS/browser font stacks, which is a real risk for
// a game whose entire premise is "does this shape exactly match the last
// one," and the rest of the codebase has no icon-library dependency to
// begin with.
export const SYMBOL_POOL = ["●", "■", "▲", "◆", "★", "✦", "✚", "⬢"] as const;

export const SPEED_STARTING_LIVES = 3;

// Every tick shows one symbol for `interval` ms before it's judged a
// timeout; a growing correct-answer streak shrinks that interval, capped at
// the floor so it never becomes literally unreactable.
export const SPEED_INTERVAL_START_MS = 1500;
export const SPEED_INTERVAL_FLOOR_MS = 400;
export const SPEED_INTERVAL_DECREMENT_MS = 40;

// How long a resolved symbol's green/red feedback stays visible before the
// next tick begins.
export const SPEED_RESOLVED_FADE_MS = 350;
