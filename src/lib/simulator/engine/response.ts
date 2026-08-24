/**
 * Audience response: reach, fatigue, clicks, and conversions.
 *
 * The auction decides what an impression costs. This decides what it is worth.
 *
 * The important property here is that fatigue and saturation are *emergent*: no
 * event says "your creative is now tired". A learner who leaves one ad running on
 * one audience watches frequency climb, CTR sag and CPM drift up, and has to
 * recognise the pattern themselves. That is the whole point of module 6.1, and it
 * only works if the model produces the pattern honestly.
 */

import { MODEL, type CreativeAttributes, type SimAudience } from './types';
import { jitter, type Rng } from './rng';

/**
 * New unique people reached by today's impressions.
 *
 * Reach grows sub-linearly and asymptotes at the pool size: the more of an
 * audience you have already touched, the more of today's impressions land on
 * someone who has seen you before. This single curve is what makes small
 * retargeting pools saturate in days while a broad pool absorbs spend for weeks.
 */
export function newReach(impressions: number, poolSize: number, alreadyReached: number): number {
  const remaining = Math.max(0, poolSize - alreadyReached);
  if (remaining <= 0 || impressions <= 0) return 0;
  const absorbed = 1 - Math.exp(-impressions / Math.max(1, poolSize * MODEL.reachSaturationFactor));
  return remaining * absorbed;
}

/**
 * CTR decay as a creative's frequency climbs against its audience.
 *
 * Flat until `fatigueOnsetFrequency` (the first couple of exposures do no harm and
 * often help), then exponential. Calibrated so a creative at frequency ~4.2 has
 * lost roughly half its click-through rate, matching the fatigue signature the
 * curriculum quizzes on.
 */
export function fatigueFactor(frequency: number, fatigueRate: number): number {
  const over = Math.max(0, frequency - MODEL.fatigueOnsetFrequency);
  return Math.exp(-fatigueRate * over);
}

/** Baseline click-through before creative or fatigue, purely a function of how
 *  warm the audience is. Warm people click far more; that is what "warm" means. */
export function baseCtr(warmth: number): number {
  return MODEL.baseCtrCold + (MODEL.baseCtrWarm - MODEL.baseCtrCold) * clamp01(warmth);
}

/** Baseline click-to-purchase rate, again driven by warmth. */
export function baseCvr(warmth: number): number {
  return MODEL.baseCvrCold + (MODEL.baseCvrWarm - MODEL.baseCvrCold) * clamp01(warmth);
}

/**
 * How well a given creative suits a given audience temperature.
 *
 * `coldAffinity` above 1 means the creative earns attention from strangers; below
 * 1 means it assumes prior context. Running a cart-abandonment nudge at a cold
 * audience should underperform, and this is where that happens.
 */
export function warmthFit(creative: CreativeAttributes, warmth: number): number {
  const coldness = 1 - clamp01(warmth);
  return 1 + (creative.coldAffinity - 1) * (coldness * 2 - 1);
}

export interface ClickInputs {
  impressions: number;
  audience: SimAudience;
  creative: CreativeAttributes;
  /** This creative's cumulative frequency against this audience. */
  creativeFrequency: number;
  noiseSpread: number;
}

export function computeLinkClicks(i: ClickInputs, rng: Rng): number {
  const ctrPct =
    baseCtr(i.audience.warmth) *
    i.creative.baseCtrMultiplier *
    warmthFit(i.creative, i.audience.warmth) *
    fatigueFactor(i.creativeFrequency, i.creative.fatigueRate) *
    jitter(rng, i.noiseSpread);

  return Math.max(0, Math.round(i.impressions * (Math.max(0.02, ctrPct) / 100)));
}

export interface ConversionInputs {
  linkClicks: number;
  audience: SimAudience;
  /** Account-level multiplier: a broken checkout drags every campaign down at once. */
  landingPageQuality: number;
  learningPenalty: boolean;
  noiseSpread: number;
}

export function computePurchases(i: ConversionInputs, rng: Rng): number {
  const cvrPct =
    baseCvr(i.audience.warmth) *
    i.landingPageQuality *
    (i.learningPenalty ? MODEL.learningCvrPenalty : 1) *
    jitter(rng, i.noiseSpread);

  const expected = i.linkClicks * (Math.max(0, cvrPct) / 100);
  return poissonish(expected, rng);
}

/**
 * Rounds an expected conversion count to a whole number with realistic lumpiness.
 *
 * Purchases arrive in ones, not in decimals, and at low volume that granularity is
 * the entire reason small samples mislead. Rounding deterministically would hide
 * exactly the noise module 5.3 teaches learners to respect, so the fractional part
 * is resolved by a coin flip against the seeded stream.
 */
function poissonish(expected: number, rng: Rng): number {
  if (expected <= 0) return 0;
  const whole = Math.floor(expected);
  return whole + (rng() < expected - whole ? 1 : 0);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
