/**
 * Public surface of the simulation engine.
 *
 * Everything below this barrel is pure: no DB, no React, no clock. Callers supply
 * a state and a seed and get back a new state plus what happened. Persistence
 * (src/lib/simulator/account.ts) and the API routes wrap it; nothing inside
 * reaches back out.
 */

export * from './types';
export { mulberry32, stringSeed, streamFor, jitter, type Rng } from './rng';
export { tick, run, type TickOptions } from './delivery';
export {
  scarcityMultiplier, qualityMultiplier, frequencyPressure, overlapPenalty, computeCpm,
} from './auction';
export {
  newReach, fatigueFactor, baseCtr, baseCvr, warmthFit, computeLinkClicks, computePurchases,
} from './response';
export {
  optimisationEvents, trailingEventTotal, pushTrailing, learningStateFor, isPenalised,
  resetLearning, isSignificantEdit,
} from './learning';
export { allocateCbo, budgetsForCampaign, paceSpend } from './budget';
export { budgetShock, updateBudgetEma, NO_SHOCK, type BudgetShock } from './shock';
export { validateEdit, type ValidationResult } from './validate';
export {
  applyEdit, previewReset,
  type SimEdit, type EditResult, type EntityLevel, type NewCampaign, type NewAdSet, type NewAd,
} from './edits';
