/**
 * Seeded randomness.
 *
 * Every random draw in the simulator flows through here so a run is fully
 * reproducible from its seed: the same account, the same actions, and the same
 * seed always produce byte-identical output. That is what lets the calibration
 * script assert on model behaviour, and what would let a learner replay or share
 * a scenario and see the same thing happen.
 *
 * mulberry32 is the same generator the frozen demo series already uses
 * (src/lib/simulator/demo-account.ts), kept for consistency: small, fast, and
 * more than good enough for simulating ad delivery.
 */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stringSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * A generator scoped to one (account seed, day, entity) triple.
 *
 * Deriving a fresh stream per entity per day, rather than threading one generator
 * through the whole tick, keeps each entity's noise independent of how many other
 * entities happen to exist. Without this, adding an ad set would silently change
 * every other ad set's results for that day, and no calibration test comparing two
 * structures could ever be trusted.
 */
export function streamFor(seed: number, day: number, entityId: string): Rng {
  return mulberry32((seed ^ Math.imul(day + 1, 0x9e3779b1) ^ stringSeed(entityId)) | 0);
}

/** Symmetric multiplicative jitter: `spread` of 0.14 gives roughly ±14%. */
export function jitter(rng: Rng, spread: number): number {
  return 1 + (rng() * 2 - 1) * spread;
}
