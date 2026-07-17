// Slight stagger between targets within the same wave, so several loading
// together doesn't pop in as one simultaneous blob.
export const AIM_WAVE_STAGGER_MS = 130;
export const AIM_TARGET_SIZE_PCT = 8;
// Chance any given target slides to a new spot during its own lifetime.
export const AIM_MOVING_TARGET_CHANCE = 0.35;
// Minimum center-to-center distance (in xPct/yPct units) kept between any
// two targets that could be on screen at the same time.
export const AIM_MIN_TARGET_DISTANCE_PCT = 16;

// Endless mode ramps its own pace over time until the player runs out of
// lives. Difficulty leans on *more targets to click* well before it leans on
// *faster* — concurrency climbs from wave 0, but lifetime/delay (the speed
// knobs) don't start dropping until ENDLESS_SPEED_RAMP_START_WAVE, by which
// point concurrency is already near its cap. Getting overwhelmed by count
// should come first; getting overwhelmed by pace should come much later.
export const ENDLESS_STARTING_LIVES = 3;
export const ENDLESS_MAX_LIVES = 5;
// Waves cleared back-to-back with zero mistakes earn a life back (up to the
// cap above) — a comeback mechanic that can trigger any number of times
// during a run, not just once.
export const ENDLESS_CLEAN_STREAK_FOR_LIFE = 5;
export const ENDLESS_WAVE_SIZE_MIN = 1;
export const ENDLESS_WAVE_SIZE_MAX = 10;
// Every N waves, max concurrent targets climbs by one (up to the cap above)
// — reaches the new cap around wave 46.
export const ENDLESS_WAVES_PER_SIZE_STEP = 5;
// Waves before this stay at the starting lifetime/delay entirely — no speed
// ramp at all yet, just more targets. Pushed out to line up with roughly
// where concurrency now maxes out, so speed genuinely doesn't start
// climbing until count is done climbing.
export const ENDLESS_SPEED_RAMP_START_WAVE = 45;
export const ENDLESS_LIFETIME_START_MS = 1600;
export const ENDLESS_LIFETIME_FLOOR_MS = 750;
export const ENDLESS_LIFETIME_DROP_PER_WAVE_MS = 10;
// On top of the ramped base lifetime above, each target beyond the first in
// a wave adds this much — a 10-target wave needs a lot more time to get
// through than a 1-target wave at the same ramp point. Waves at the higher
// end of the concurrency range (5+) were still feeling rushed to clear even
// with the previous per-extra-target bonus, so this is weighted heavily.
export const ENDLESS_LIFETIME_PER_EXTRA_TARGET_MS = 350;
export const ENDLESS_WAVE_DELAY_START_MS = 650;
export const ENDLESS_WAVE_DELAY_FLOOR_MS = 350;
export const ENDLESS_WAVE_DELAY_DROP_PER_WAVE_MS = 4;
