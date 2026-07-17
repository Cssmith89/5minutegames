import { randomFloat } from "@/lib/dailySeed";
import { AIM_MIN_TARGET_DISTANCE_PCT, AIM_MOVING_TARGET_CHANCE, AIM_TARGET_SIZE_PCT } from "./config";

export interface WaveTargetSpec {
  xPct: number;
  yPct: number;
  /** Equal to xPct/yPct for stationary targets; different for ones that slide. */
  endXPct: number;
  endYPct: number;
  lifetimeMs: number;
  /** 1-indexed position within its wave, shown as a label on the target. */
  order: number;
}

interface Point {
  x: number;
  y: number;
}

// A stationary target is represented as a zero-length segment (start===end),
// so path-clearance checks work the same way whether or not a target moves.
interface Segment {
  start: Point;
  end: Point;
}

// Waves are shown strictly one at a time (the next only spawns once every
// target in the current one is resolved), so rejection sampling only ever
// needs to keep the handful of paths within a single wave apart — but
// Endless mode can pack up to 10 concurrent, so it needs more tries than a
// size-2 or size-3 wave to reliably find a clean path for all of them.
const MAX_PLACEMENT_ATTEMPTS = 4000;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function closestPointOnSegment(p: Point, seg: Segment): Point {
  const abx = seg.end.x - seg.start.x;
  const aby = seg.end.y - seg.start.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return seg.start;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - seg.start.x) * abx + (p.y - seg.start.y) * aby) / lenSq),
  );
  return { x: seg.start.x + t * abx, y: seg.start.y + t * aby };
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function onSegment(a: Point, p: Point, b: Point): boolean {
  return (
    Math.min(a.x, b.x) <= p.x &&
    p.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= p.y &&
    p.y <= Math.max(a.y, b.y)
  );
}

function segmentsIntersect(a: Segment, b: Segment): boolean {
  const d1 = cross(b.start, b.end, a.start);
  const d2 = cross(b.start, b.end, a.end);
  const d3 = cross(a.start, a.end, b.start);
  const d4 = cross(a.start, a.end, b.end);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  if (d1 === 0 && onSegment(b.start, a.start, b.end)) return true;
  if (d2 === 0 && onSegment(b.start, a.end, b.end)) return true;
  if (d3 === 0 && onSegment(a.start, b.start, a.end)) return true;
  if (d4 === 0 && onSegment(a.start, b.end, a.end)) return true;
  return false;
}

// Minimum distance between two segments — 0 if they cross anywhere, else the
// smallest endpoint-to-opposite-segment distance. Degenerate (start===end)
// segments fall out of this naturally as plain point-to-segment distance.
function segmentDistance(a: Segment, b: Segment): number {
  if (segmentsIntersect(a, b)) return 0;
  return Math.min(
    distance(a.start, closestPointOnSegment(a.start, b)),
    distance(a.end, closestPointOnSegment(a.end, b)),
    distance(b.start, closestPointOnSegment(b.start, a)),
    distance(b.end, closestPointOnSegment(b.end, a)),
  );
}

// A group of already-placed paths and the minimum distance a new one must
// keep from all of them. Two groups get checked per candidate: the current
// wave's own targets (strict — these are live and clickable, so paths must
// never cross) and the previous wave's leftover, fading targets (loose —
// they're not clickable anymore, so the only thing that matters is not
// visually sitting on top of one until it finishes fading).
interface OccupiedGroup {
  segments: Segment[];
  minDistance: number;
}

function clearOfGroups(candidate: Segment, groups: OccupiedGroup[]): boolean {
  return groups.every((group) =>
    group.segments.every((seg) => segmentDistance(candidate, seg) >= group.minDistance),
  );
}

// Rejection-samples a spot clear of every given group's paths (not just
// their endpoints); falls back to the last candidate if it can't find a
// clean one in time, rather than looping forever.
function pickPoint(rng: () => number, margin: number, groups: OccupiedGroup[]): Point {
  let candidate: Point = { x: 50, y: 50 };
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    candidate = {
      x: randomFloat(rng, margin, 100 - margin),
      y: randomFloat(rng, margin, 100 - margin),
    };
    if (clearOfGroups({ start: candidate, end: candidate }, groups)) return candidate;
  }
  return candidate;
}

// Same idea, but for a moving target's end point: the whole travel path from
// `start` to the candidate must stay clear of every group, not just the end
// point itself — otherwise two bubbles' paths could cross mid-flight,
// momentarily overlapping and blocking clicks on either one.
function pickSegmentEnd(
  rng: () => number,
  margin: number,
  start: Point,
  groups: OccupiedGroup[],
): Point {
  let candidate: Point = start;
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    candidate = {
      x: randomFloat(rng, margin, 100 - margin),
      y: randomFloat(rng, margin, 100 - margin),
    };
    if (clearOfGroups({ start, end: candidate }, groups)) return candidate;
  }
  return candidate;
}

// The "keep paths clear" distance rejection sampling enforces between two
// targets that are both genuinely live/clickable at once. Endless mode can
// pack up to 10 concurrent targets into the same play area that comfortably
// fits 5 at the standard spacing, so beyond 5 the requirement eases off —
// down to a floor that still keeps a couple percent of clear space between
// bubble edges (bubbles are AIM_TARGET_SIZE_PCT wide), just not the roomier
// gap smaller waves get.
function minDistanceFor(waveSize: number): number {
  const relaxed =
    AIM_MIN_TARGET_DISTANCE_PCT - Math.max(waveSize - 5, 0) * 1.2;
  return Math.max(relaxed, AIM_TARGET_SIZE_PCT + 4);
}

// Distance kept from the *previous* wave's leftover paths — those targets
// are already resolved and unclickable (fading out), so this only needs to
// rule out the bubbles' circles actually overlapping, not the full
// live-clearance a genuinely concurrent pair needs. Center-to-center equal
// to the bubble's own diameter means the two circles can touch but not
// overlap.
const PREVIOUS_WAVE_MIN_DISTANCE = AIM_TARGET_SIZE_PCT;

// Generates one wave's worth of targets: waveSize of them, each carrying a
// 1-indexed "order" for its position within the wave, with every target's
// full path (not just its start/end points) kept clear of every other
// target's path so moving bubbles never cross and block each other's
// clicks. Endless mode calls this once per wave as the round progresses.
//
// `previousWave` carries forward the prior wave's target paths (if any) so
// this wave's targets also steer clear of them — resolved targets keep
// rendering (fading out, harmless to click) for a short time after the wave
// technically ends, and without this a freshly spawned target could land
// right on top of one still fading from the last wave, visually overlapping
// it until the fade finishes.
export function generateWaveTargets(
  rng: () => number,
  waveSize: number,
  lifetimeMs: number,
  previousWave: WaveTargetSpec[] = [],
): WaveTargetSpec[] {
  const margin = AIM_TARGET_SIZE_PCT;
  const minDistance = minDistanceFor(waveSize);
  const sameWave: Segment[] = [];
  const groups: OccupiedGroup[] = [
    { segments: sameWave, minDistance },
    {
      segments: previousWave.map((t) => ({
        start: { x: t.xPct, y: t.yPct },
        end: { x: t.endXPct, y: t.endYPct },
      })),
      minDistance: PREVIOUS_WAVE_MIN_DISTANCE,
    },
  ];
  const wave: WaveTargetSpec[] = [];

  for (let i = 0; i < waveSize; i++) {
    const start = pickPoint(rng, margin, groups);

    const moving = rng() < AIM_MOVING_TARGET_CHANCE;
    const end = moving ? pickSegmentEnd(rng, margin, start, groups) : start;
    sameWave.push({ start, end });

    wave.push({
      xPct: start.x,
      yPct: start.y,
      endXPct: end.x,
      endYPct: end.y,
      lifetimeMs,
      order: i + 1,
    });
  }

  return wave;
}
