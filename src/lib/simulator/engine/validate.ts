/**
 * Validation for edits arriving from a client.
 *
 * `applyEdit` trusts what it is given, which is fine for missions and the
 * calibration script because those construct edits in-process. Anything arriving
 * over HTTP is different: a crafted request could otherwise create a campaign with
 * an objective the model has never heard of, a negative budget, or an ad pointing
 * at a creative that does not exist, and the failure would surface days later as a
 * confusing tick rather than as a rejected request.
 *
 * Kept separate from `applyEdit` so the engine stays a pure state machine and the
 * boundary check lives at the boundary.
 */

import {
  EVENT_FREQUENCY_MULTIPLIER,
  type BidStrategy,
  type BudgetMode,
  type EntityStatus,
  type Objective,
  type OptimisationEvent,
  type SimState,
  type StrategyTag,
} from './types';
import type { EntityLevel, SimEdit } from './edits';

const OBJECTIVES: Objective[] = ['awareness', 'traffic', 'engagement', 'leads', 'app_promotion', 'sales'];
const BUDGET_MODES: BudgetMode[] = ['cbo', 'abo'];
const BID_STRATEGIES: BidStrategy[] = ['highest_volume', 'cost_cap'];
const STRATEGY_TAGS: StrategyTag[] = ['prospecting', 'retargeting', 'catalog'];
const STATUSES: EntityStatus[] = ['active', 'paused', 'archived'];
const LEVELS: EntityLevel[] = ['campaign', 'adset', 'ad'];
const OPT_EVENTS = Object.keys(EVENT_FREQUENCY_MULTIPLIER) as OptimisationEvent[];
const FORMATS = ['image', 'video', 'carousel', 'collection'];

/** Budgets are rupees per day. The ceiling is a sanity guard, not a business rule:
 *  it stops a fat-fingered or crafted value from producing a nonsense simulation. */
const MIN_BUDGET = 50;
const MAX_BUDGET = 10_000_000;

const MAX_NAME = 120;
const MAX_TEXT = 2_000;

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const ok: ValidationResult = { ok: true };
const bad = (error: string): ValidationResult => ({ ok: false, error });

function isName(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_NAME;
}

function isBudget(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= MIN_BUDGET && v <= MAX_BUDGET;
}

function isText(v: unknown, max = MAX_TEXT): v is string {
  return typeof v === 'string' && v.length <= max;
}

/**
 * Checks an edit against the state it will be applied to.
 *
 * Existence checks are deliberately included here rather than left to `applyEdit`'s
 * own guards: those return a friendly message, but validating first means the route
 * never has to distinguish "you asked for something impossible" from "you asked for
 * something malformed".
 */
export function validateEdit(
  state: SimState,
  edit: SimEdit,
  knownCreative: (id: string) => boolean,
): ValidationResult {
  const hasCampaign = (id: string) => state.campaigns.some((c) => c.id === id);
  const hasAdSet = (id: string) => state.adSets.some((a) => a.id === id);
  const hasAudience = (id: string) => state.audiences.some((a) => a.id === id);
  const freshId = (id: unknown): id is string =>
    typeof id === 'string' && /^[a-z0-9-]{4,64}$/i.test(id)
    && !hasCampaign(id) && !hasAdSet(id) && !hasAudience(id)
    && !state.ads.some((a) => a.id === id);

  switch (edit.kind) {
    case 'setStatus':
      if (!LEVELS.includes(edit.level)) return bad('Unknown level.');
      if (!STATUSES.includes(edit.status)) return bad('Unknown status.');
      return ok;

    case 'rename':
      if (!LEVELS.includes(edit.level)) return bad('Unknown level.');
      if (!isName(edit.name)) return bad('Name must be 1 to 120 characters.');
      return ok;

    case 'setCampaignBudget':
    case 'setAdSetBudget':
      if (!isBudget(edit.dailyBudget)) return bad(`Daily budget must be between ₹${MIN_BUDGET} and ₹${MAX_BUDGET.toLocaleString('en-IN')}.`);
      return ok;

    case 'setBidStrategy':
      if (!BID_STRATEGIES.includes(edit.bidStrategy)) return bad('Unknown bid strategy.');
      if (edit.bidStrategy === 'cost_cap' && !isBudget(edit.costCap)) return bad('A cost cap needs a target cost per result.');
      return ok;

    case 'setBudgetMode':
      if (!BUDGET_MODES.includes(edit.budgetMode)) return bad('Unknown budget mode.');
      if (edit.budgetMode === 'cbo' && edit.dailyBudget !== undefined && !isBudget(edit.dailyBudget)) {
        return bad('Campaign budget is out of range.');
      }
      return ok;

    case 'setAudience':
      if (!hasAudience(edit.audienceId)) return bad('That audience does not exist.');
      return ok;

    case 'setOptimisationEvent':
      if (!OPT_EVENTS.includes(edit.optimisationEvent)) return bad('Unknown optimisation event.');
      return ok;

    case 'setPlacements':
      if (typeof edit.advantagePlacements !== 'boolean') return bad('Placements must be on or off.');
      return ok;

    case 'setAdCreative':
      if (!knownCreative(edit.creativeId)) return bad('That creative is not in the library.');
      if (!FORMATS.includes(edit.format)) return bad('Unknown ad format.');
      return ok;

    case 'setAdCopy':
      if (!isText(edit.primaryText) || !isText(edit.headline, 200) || !isText(edit.description, 400)) {
        return bad('Ad copy is too long.');
      }
      if (!isText(edit.cta, 40)) return bad('Choose a call to action.');
      if (!isText(edit.destinationUrl, 500)) return bad('Destination URL is too long.');
      return ok;

    case 'createCampaign': {
      const c = edit.campaign;
      if (!freshId(c?.id)) return bad('Invalid or duplicate campaign id.');
      if (!isName(c.name)) return bad('Give the campaign a name.');
      if (!OBJECTIVES.includes(c.objective)) return bad('Choose a campaign objective.');
      if (!BUDGET_MODES.includes(c.budgetMode)) return bad('Choose where the budget lives.');
      if (!BID_STRATEGIES.includes(c.bidStrategy)) return bad('Choose a bid strategy.');
      if (!STRATEGY_TAGS.includes(c.strategyTag)) return bad('Choose a strategy.');
      // A CBO campaign without a budget would deliver nothing and look broken.
      if (c.budgetMode === 'cbo' && !isBudget(c.dailyBudget)) return bad('A campaign budget needs a daily amount.');
      if (c.bidStrategy === 'cost_cap' && !isBudget(c.costCap)) return bad('A cost cap needs a target cost per result.');
      return ok;
    }

    case 'createAdSet': {
      const a = edit.adSet;
      if (!freshId(a?.id)) return bad('Invalid or duplicate ad set id.');
      if (!isName(a.name)) return bad('Give the ad set a name.');
      if (!hasCampaign(a.campaignId)) return bad('That campaign does not exist.');
      if (!hasAudience(a.audienceId)) return bad('That audience does not exist.');
      if (!OPT_EVENTS.includes(a.optimisationEvent)) return bad('Choose an optimisation event.');
      if (typeof a.advantagePlacements !== 'boolean') return bad('Placements must be on or off.');
      // Mirrors the budget-mode rule the edit path enforces: an ABO ad set owns its
      // budget, a CBO one must not carry a competing figure.
      const parent = state.campaigns.find((c) => c.id === a.campaignId)!;
      if (parent.budgetMode === 'abo' && !isBudget(a.dailyBudget)) return bad('This campaign uses ad set budgets, so give the ad set one.');
      if (parent.budgetMode === 'cbo' && a.dailyBudget !== undefined) return bad('This campaign uses Campaign Budget Optimization, so the ad set has no budget of its own.');
      return ok;
    }

    case 'createAd': {
      const ad = edit.ad;
      if (!freshId(ad?.id)) return bad('Invalid or duplicate ad id.');
      if (!isName(ad.name)) return bad('Give the ad a name.');
      if (!hasAdSet(ad.adSetId)) return bad('That ad set does not exist.');
      if (!knownCreative(ad.creativeId)) return bad('That creative is not in the library.');
      if (!FORMATS.includes(ad.format)) return bad('Unknown ad format.');
      if (!isText(ad.primaryText) || !isText(ad.headline, 200) || !isText(ad.description, 400)) {
        return bad('Ad copy is too long.');
      }
      if (!isText(ad.cta, 40)) return bad('Choose a call to action.');
      if (!isText(ad.destinationUrl, 500)) return bad('Destination URL is too long.');
      return ok;
    }

    case 'createAudience': {
      const aud = edit.audience;
      if (!freshId(aud?.id)) return bad('Invalid or duplicate audience id.');
      if (!isName(aud.name)) return bad('Give the audience a name.');
      if (typeof aud.size !== 'number' || !Number.isFinite(aud.size) || aud.size < 1_000 || aud.size > 500_000_000) {
        return bad('Audience size is out of range.');
      }
      if (typeof aud.warmth !== 'number' || aud.warmth < 0 || aud.warmth > 1) return bad('Audience warmth must be between 0 and 1.');
      return ok;
    }

    case 'duplicateAdSet':
      if (!hasAdSet(edit.id)) return bad('That ad set does not exist.');
      if (!freshId(edit.newId)) return bad('Invalid or duplicate ad set id.');
      if (!isName(edit.name)) return bad('Give the copy a name.');
      if (edit.audienceId !== undefined && !hasAudience(edit.audienceId)) return bad('That audience does not exist.');
      if (!Array.isArray(edit.newAdIds) || edit.newAdIds.some((id) => !freshId(id))) {
        return bad('Invalid ids for the duplicated ads.');
      }
      return ok;

    default:
      return bad('Unknown edit.');
  }
}
