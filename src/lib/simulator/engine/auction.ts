/**
 * The auction: what it costs to be seen.
 *
 * Every impression on Meta is won or lost in an auction, and the price is not set
 * by your bid alone. This module turns the levers a learner actually controls
 * (who they target, what creative they run, how many ad sets they point at the
 * same people) into a CPM, so that the curriculum's claims about the auction are
 * things the account demonstrates rather than things a lesson asserts.
 *
 * Each factor below maps to a specific lesson:
 *   scarcity        -> narrow audiences cost more (module 2.2)
 *   quality         -> "creative is the new targeting" (module 1.2)
 *   frequency       -> saturation raises CPM (module 6.1)
 *   overlap         -> duplicating onto the same audience is self-competition (7.2)
 *   learning penalty-> unstable delivery is more expensive (module 4.2)
 */

import { MODEL, WEEKDAY_WEIGHT, type CreativeAttributes, type SimAudience } from './types';
import { jitter, type Rng } from './rng';

/** Narrow pools have fewer impressions to go round, so they cost more per thousand. */
export function scarcityMultiplier(audienceSize: number): number {
  if (audienceSize <= 0) return MODEL.scarcityMax;
  const ratio = MODEL.referenceAudienceSize / audienceSize;
  return Math.min(MODEL.scarcityMax, Math.max(1, ratio ** MODEL.scarcityExponent));
}

/**
 * Better creative wins impressions more cheaply, because engagement is one of the
 * three components of Meta's Total Value. Expressed relative to an average
 * creative so a neutral one costs exactly the base rate.
 */
export function qualityMultiplier(creative: CreativeAttributes): number {
  const quality = creative.baseCtrMultiplier * 0.7 + creative.hookStrength * 0.3;
  // Strong creative earns up to ~18% off; weak creative pays up to ~25% more.
  return Math.min(1.25, Math.max(0.82, 1 / quality ** 0.55));
}

/** Once people have seen the ad several times, winning their attention costs more. */
export function frequencyPressure(frequency: number): number {
  const over = Math.max(0, frequency - MODEL.fatigueOnsetFrequency);
  return 1 + over * MODEL.frequencyPressurePerPoint;
}

/**
 * How much extra you pay for pointing several live ad sets at the same people.
 *
 * `siblings` counts the other active ad sets sharing this audience's overlap group.
 * At zero this returns 1 and costs nothing, which is why a learner only ever feels
 * it after they duplicate onto the same audience rather than a fresh one.
 */
export function overlapPenalty(siblings: number): number {
  return 1 + Math.max(0, siblings) * MODEL.overlapPenaltyPerSibling;
}

export interface CpmInputs {
  audience: SimAudience;
  creative: CreativeAttributes;
  frequency: number;
  overlappingSiblings: number;
  learningPenalty: boolean;
  advantagePlacements: boolean;
  marketPressure: number;
  weekdayIndex: number;
  noiseSpread: number;
}

export function computeCpm(i: CpmInputs, rng: Rng): number {
  const cpm =
    MODEL.baseCpm *
    scarcityMultiplier(i.audience.size) *
    qualityMultiplier(i.creative) *
    frequencyPressure(i.frequency) *
    overlapPenalty(i.overlappingSiblings) *
    (i.learningPenalty ? MODEL.learningCpmPenalty : 1) *
    (i.advantagePlacements ? MODEL.advantagePlacementCpmDiscount : 1) *
    i.marketPressure *
    WEEKDAY_WEIGHT[i.weekdayIndex] *
    jitter(rng, i.noiseSpread);

  return Math.max(1, cpm);
}
