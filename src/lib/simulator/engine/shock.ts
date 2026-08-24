/**
 * Budget shock: what it costs to scale too fast.
 *
 * An ad set's delivery settles at the spend level it has been running at. Ask it
 * to spend several times that overnight and it has to win impressions it was
 * previously outbid on or declined to chase: pricier inventory, shown to people
 * further from the ones who were converting. ROAS drops even though nothing about
 * the creative, the audience or the offer changed.
 *
 * This is deliberately separate from the learning-phase reset. A big budget edit
 * usually triggers both, but they are different mechanisms with different shapes:
 * the learning reset ends as soon as enough events accumulate, while the shock
 * fades only as the new spend level becomes the ad set's normal. Modelling them
 * separately is what makes module 7.1's "scale ~20% at a time" advice show up as
 * a measurable difference rather than a slogan.
 */

import { MODEL } from './types';

export interface BudgetShock {
  /** Multiplier on CPM, >= 1. */
  cpm: number;
  /** Multiplier on conversion rate, <= 1. */
  cvr: number;
  /** How far above its settled level this ad set is spending, for display. */
  ratio: number;
}

export const NO_SHOCK: BudgetShock = { cpm: 1, cvr: 1, ratio: 1 };

/**
 * Compares today's budget against the level delivery has settled into.
 *
 * A brand-new ad set (no EMA yet) is not shocked: it has no settled level to
 * depart from, and punishing a launch would teach the wrong thing entirely.
 */
export function budgetShock(todayBudget: number, budgetEma: number): BudgetShock {
  if (budgetEma <= 0 || todayBudget <= 0) return NO_SHOCK;

  const ratio = todayBudget / budgetEma;
  if (ratio <= MODEL.budgetShockThreshold) return { ...NO_SHOCK, ratio };

  const over = ratio - MODEL.budgetShockThreshold;
  return {
    ratio,
    cpm: 1 + over * MODEL.budgetShockCpmPerPoint,
    cvr: 1 - Math.min(MODEL.budgetShockCvrMax, over * MODEL.budgetShockCvrPerPoint),
  };
}

/** Moves the settled level toward today's actual budget. */
export function updateBudgetEma(budgetEma: number, todayBudget: number): number {
  if (budgetEma <= 0) return todayBudget;
  return budgetEma + (todayBudget - budgetEma) * MODEL.budgetEmaAlpha;
}
