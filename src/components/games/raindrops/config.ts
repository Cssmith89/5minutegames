export const RAIN_STARTING_LIVES = 3;
export const RAIN_MAX_LIVES = 5;
// Correct answers in a row (across drops, resets on any miss) needed to
// refund a life, up to RAIN_MAX_LIVES — same numbers reflex-test uses.
export const RAIN_CLEAN_STREAK_FOR_LIFE = 5;
// How long the lives indicator's "gained a life" blink lasts.
export const RAIN_LIFE_GAIN_BLINK_MS = 600;

// Fall duration is driven entirely by the equation's own difficulty (see
// computeFallMs in equations.ts), not by score — the player should get more
// time as problems get harder, not less. Multiplication gets a higher base
// than add/subtract since it's inherently harder even at small operands,
// and every equation gets extra time per digit in its answer.
export const RAIN_FALL_MS_ADD_BASE = 5500;
export const RAIN_FALL_MS_SUBTRACT_BASE = 5500;
export const RAIN_FALL_MS_MULTIPLY_BASE = 7500;
export const RAIN_FALL_MS_PER_DIGIT = 900;
export const RAIN_FALL_MS_CEILING = 12000;

// These no longer drive an open-ended ramp for the whole run — they only
// anchor the "dip bottom" pace (see RAIN_PACE_RECOVERY_SCORE_SPAN below),
// evaluated once at the score where the taper ends, rather than continuing
// to scale with score indefinitely.
export const RAIN_SPAWN_MS_START = 4000;
export const RAIN_SPAWN_MS_FLOOR = 1500;
export const RAIN_SPAWN_MS_PER_POINT = 40;

// How many drops can be falling (unresolved) at once — an explicit cap
// rather than whatever falls out of fallMs÷spawnDelay, so a player is never
// suddenly buried. Trial range: 1 up to 5. Same "dip-bottom anchor" caveat
// as above applies.
export const RAIN_MAX_CONCURRENT_START = 1;
export const RAIN_MAX_CONCURRENT_CEILING = 5;
export const RAIN_MAX_CONCURRENT_SCORE_PER_STEP = 8;

// While only single-digit problems are in the pool (score below the addition
// mixed-shape unlock), pace is boosted to fast/busy since they're trivial to
// solve — then eases back down to the ramp above once mixed/double-digit
// problems start appearing, so a harder problem still gets more solo screen
// time. Reuses RAIN_ADD_SHAPE_MIXED_SCORE as the boundary rather than a
// separate threshold, since that's the constant that already defines "easy".
export const RAIN_EASY_STAGE_SPAWN_MS = 1700;
export const RAIN_EASY_STAGE_MAX_CONCURRENT = 4;

// Rather than instantly cliffing from the easy stage's fast/busy pace down
// to the dip bottom the moment mixed shapes unlock, ease down over this
// many score points past RAIN_ADD_SHAPE_MIXED_SCORE. Kept at 1 -- a single
// wave's worth of slowdown -- so the dip reads as a brief blip right as
// problems get harder, not a sustained rough patch.
export const RAIN_EASY_STAGE_TAPER_SCORE_SPAN = 1;

// After the taper dip bottoms out, recover back UP to the easy stage's own
// pace over this many more score points, then hold there indefinitely.
// Kept at 1 so the whole cooldown (taper + recovery) is just one wave down
// and one wave back up before permanently returning to peak pace -- ongoing
// difficulty from here on comes from the numbers themselves (bigger
// operands, harder operations), not from pacing.
export const RAIN_PACE_RECOVERY_SCORE_SPAN = 1;

// Score thresholds unlocking each operation tier. Once unlocked, an
// operation stays in the pool and equations are drawn uniformly from
// whatever's unlocked — so play is already "mixed" from the multiplication
// tier onward, matching the source spec's addition -> +subtraction ->
// +multiplication -> mixed progression without a separate mixed-only tier.
export const RAIN_TIER_SUBTRACTION_SCORE = 10;
export const RAIN_TIER_MULTIPLICATION_SCORE = 25;

// Addition/subtraction ramp by digit "shape" rather than a smoothly growing
// ceiling: single-digit + single-digit first, then single+double mixed in,
// then double+double — each shape unlocks at its own score threshold and,
// once unlocked, stays in the pool (same growing-pool/uniform-pick pattern
// getTierOperations already uses for operations). Early difficulty comes
// from the spawn-rate ramp above (more single+single problems, more often),
// not from numbers growing within a shape. Subtraction's thresholds are
// offsets from its own unlock score, same "ramp from its own baseline"
// principle multiplication's operand growth already uses — addition has no
// unlock gate, so its thresholds are raw score.
export const RAIN_SINGLE_DIGIT_MAX = 9;
export const RAIN_DOUBLE_DIGIT_MIN = 10;
export const RAIN_DOUBLE_DIGIT_MAX = 99;

export const RAIN_ADD_SHAPE_MIXED_SCORE = 8;
// Pushed well past the multiplication tier (25) so xx+xx -- which can
// produce 3-digit sums -- only shows up for advanced/late-game play instead
// of the early-mid game.
export const RAIN_ADD_SHAPE_DOUBLE_SCORE = 60;

export const RAIN_SUBTRACT_SHAPE_MIXED_OFFSET = 8;
export const RAIN_SUBTRACT_SHAPE_DOUBLE_OFFSET = 20;

// Multiplication's ceiling grows slower than add/subtract (once every few
// points rather than every point) since the product grows quadratically
// with the operands, not linearly. Capped at 10 — kept to standard
// times-table range for the whole game, not just early on.
export const RAIN_MULTIPLY_MAX_START = 9;
export const RAIN_MULTIPLY_MAX_CEILING = 10;
export const RAIN_MULTIPLY_MAX_PER_POINT_DIVISOR = 3;

// The floor of the multiplication range also creeps up slowly, so late-game
// multiplication stops drawing trivial small factors like 2x anything.
export const RAIN_MULTIPLY_MIN_START = 2;
export const RAIN_MULTIPLY_MIN_CEILING = 6;
export const RAIN_MULTIPLY_MIN_PER_POINT_DIVISOR = 10;

// How long a resolved drop (correct or missed) fades out before removal.
export const RAIN_RESOLVED_FADE_MS = 300;
