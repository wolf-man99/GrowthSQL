/**
 * The learning phase and the 50-event rule.
 *
 * Meta needs a minimum volume of optimisation events before its delivery settles.
 * Under that threshold an ad set is permanently exploring: erratic, expensive, and
 * never quite reliable. Learn module 4.2 teaches this and gives two escapes
 * (consolidate budget into fewer ad sets, or optimise for a cheaper event); this
 * module is what makes both of those actually work in the simulator.
 *
 * It is also where "every edit has a cost" (module 6.3) becomes real: a
 * significant edit calls `resetLearning`, throwing away accumulated progress.
 */

import { EVENT_FREQUENCY_MULTIPLIER, MODEL, type SimAdSet } from './types';

/** Purchases converted into whatever event this ad set optimises toward. Optimising
 *  for Add to Cart yields several times more events than Purchase, which is exactly
 *  why it is the recommended escape from Learning Limited on a small budget. */
export function optimisationEvents(purchases: number, adSet: SimAdSet): number {
  return purchases * EVENT_FREQUENCY_MULTIPLIER[adSet.optimisationEvent];
}

/** Sum of the trailing 7 days of optimisation events: the number the rule reads. */
export function trailingEventTotal(trailing: number[]): number {
  return trailing.slice(-7).reduce((a, b) => a + b, 0);
}

/** Appends today's events and drops anything older than the 7-day window. */
export function pushTrailing(trailing: number[], events: number): number[] {
  return [...trailing, events].slice(-7);
}

/**
 * Where this ad set stands right now.
 *
 * Over threshold is `active`. Under threshold splits by time: inside the grace
 * window it is still legitimately `learning`, beyond it Meta gives up and reports
 * `Learning Limited`, the state that actually costs money.
 */
export function learningStateFor(
  adSet: SimAdSet,
  day: number,
): 'learning' | 'active' | 'limited' {
  const total = trailingEventTotal(adSet.runtime.trailingEvents);
  if (total >= MODEL.learningEventThreshold) return 'active';
  const daysSinceReset = day - adSet.runtime.learningResetDay;
  return daysSinceReset < MODEL.learningGraceDays ? 'learning' : 'limited';
}

/** True when delivery should be penalised: unstable ad sets deliver worse. */
export function isPenalised(state: 'learning' | 'active' | 'limited'): boolean {
  return state !== 'active';
}

/**
 * Restarts the learning phase.
 *
 * Clears the trailing window as well as stamping the day, because Meta genuinely
 * discards what it had learned: an ad set that was one day from stabilising is
 * back to the beginning. Learners who fiddle daily should feel that.
 */
export function resetLearning(adSet: SimAdSet, day: number): void {
  adSet.runtime.learningResetDay = day;
  adSet.runtime.trailingEvents = [];
  adSet.runtime.learningState = 'learning';
}

/**
 * Whether an edit is significant enough to reset learning.
 *
 * Mirrors Meta's own rules: audience, optimisation event and creative changes
 * always reset; budget changes only when large. The threshold is why the
 * curriculum's "raise budgets ~20% at a time" advice works here, nudge gently and
 * delivery holds, jump hard and you are back in learning.
 */
export function isSignificantEdit(
  field: 'audience' | 'optimisationEvent' | 'creative' | 'budget' | 'placements' | 'status' | 'name',
  before?: number,
  after?: number,
): boolean {
  switch (field) {
    case 'audience':
    case 'optimisationEvent':
    case 'creative':
      return true;
    case 'budget': {
      if (before === undefined || after === undefined || before <= 0) return false;
      return Math.abs(after - before) / before > MODEL.significantBudgetChange;
    }
    case 'placements':
      return true;
    // Renaming is cosmetic, and pausing/resuming is handled by delivery itself.
    case 'status':
    case 'name':
      return false;
  }
}
