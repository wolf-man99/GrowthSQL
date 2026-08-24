/**
 * Every change a learner can make to their account.
 *
 * All of them funnel through `applyEdit`, and that is the point: Meta resets an ad
 * set's learning phase on a significant change, and a simulator where that rule
 * lives in six different UI handlers is a simulator where it will eventually be
 * forgotten in one of them. Routing every mutation through one function means
 * "every edit has a cost" (module 6.3) cannot be bypassed by accident.
 *
 * `applyEdit` returns which ad sets it reset, so the UI can warn before committing
 * and the debrief can point at the moment a learner threw away a stabilised ad set.
 */

import {
  emptyAdRuntime,
  emptyAdSetRuntime,
  type AdFormat,
  type BidStrategy,
  type BudgetMode,
  type EntityStatus,
  type Objective,
  type OptimisationEvent,
  type SimAd,
  type SimAdSet,
  type SimAudience,
  type SimCampaign,
  type SimState,
  type StrategyTag,
} from './types';
import { isSignificantEdit, resetLearning } from './learning';

export type EntityLevel = 'campaign' | 'adset' | 'ad';

export type SimEdit =
  | { kind: 'setStatus'; level: EntityLevel; id: string; status: EntityStatus }
  | { kind: 'rename'; level: EntityLevel; id: string; name: string }
  | { kind: 'setCampaignBudget'; id: string; dailyBudget: number }
  | { kind: 'setAdSetBudget'; id: string; dailyBudget: number }
  | { kind: 'setBidStrategy'; id: string; bidStrategy: BidStrategy; costCap?: number }
  | { kind: 'setBudgetMode'; id: string; budgetMode: BudgetMode; dailyBudget?: number }
  | { kind: 'setAudience'; id: string; audienceId: string }
  | { kind: 'setOptimisationEvent'; id: string; optimisationEvent: OptimisationEvent }
  | { kind: 'setPlacements'; id: string; advantagePlacements: boolean }
  | { kind: 'setAdCreative'; id: string; creativeId: string; format: AdFormat }
  | { kind: 'setAdCopy'; id: string; primaryText: string; headline: string; description: string; cta: string; destinationUrl: string }
  | { kind: 'createCampaign'; campaign: NewCampaign }
  | { kind: 'createAdSet'; adSet: NewAdSet }
  | { kind: 'createAd'; ad: NewAd }
  | { kind: 'createAudience'; audience: SimAudience }
  | { kind: 'duplicateAdSet'; id: string; newId: string; name: string; audienceId?: string; newAdIds: string[] };

export interface NewCampaign {
  id: string;
  name: string;
  objective: Objective;
  budgetMode: BudgetMode;
  dailyBudget?: number;
  bidStrategy: BidStrategy;
  costCap?: number;
  strategyTag: StrategyTag;
}

export interface NewAdSet {
  id: string;
  campaignId: string;
  name: string;
  audienceId: string;
  dailyBudget?: number;
  optimisationEvent: OptimisationEvent;
  advantagePlacements: boolean;
}

export interface NewAd {
  id: string;
  adSetId: string;
  name: string;
  creativeId: string;
  format: AdFormat;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  destinationUrl: string;
}

export interface EditResult {
  state: SimState;
  /** Ad set ids whose learning phase this edit restarted. */
  resetAdSetIds: string[];
  /** Human-readable rejection, when the edit could not be applied at all. */
  error?: string;
}

/**
 * Predicts whether an edit would reset learning, without applying it.
 *
 * The UI calls this to warn first ("this will restart the learning phase on 2 ad
 * sets"), which is the difference between a simulator that punishes a learner and
 * one that teaches them. The rule itself is not duplicated: both this and
 * `applyEdit` read `isSignificantEdit`.
 */
export function previewReset(state: SimState, edit: SimEdit): string[] {
  switch (edit.kind) {
    case 'setAudience':
    case 'setOptimisationEvent':
    case 'setPlacements':
      return state.adSets.some((a) => a.id === edit.id) ? [edit.id] : [];
    case 'setAdCreative': {
      const ad = state.ads.find((x) => x.id === edit.id);
      return ad ? [ad.adSetId] : [];
    }
    case 'setAdSetBudget': {
      const a = state.adSets.find((x) => x.id === edit.id);
      if (!a) return [];
      return isSignificantEdit('budget', a.dailyBudget, edit.dailyBudget) ? [a.id] : [];
    }
    case 'setCampaignBudget': {
      const c = state.campaigns.find((x) => x.id === edit.id);
      if (!c || c.budgetMode !== 'cbo') return [];
      // Under CBO the campaign's budget is every child ad set's budget, so a large
      // change unsettles all of them at once. This is a real hazard of CBO that the
      // curriculum mentions only in passing, and it is worth surfacing here.
      return isSignificantEdit('budget', c.dailyBudget, edit.dailyBudget)
        ? state.adSets.filter((a) => a.campaignId === c.id).map((a) => a.id)
        : [];
    }
    case 'setBudgetMode':
      return state.adSets.filter((a) => a.campaignId === edit.id).map((a) => a.id);
    default:
      return [];
  }
}

/**
 * Applies one edit, returning a new state.
 *
 * Never mutates the input, for the same reason `tick` does not: state is persisted
 * and replayed, and shared references between versions would be a miserable bug.
 */
export function applyEdit(state: SimState, edit: SimEdit): EditResult {
  const next: SimState = structuredClone(state);
  const day = next.day;
  const resets = new Set<string>();

  const adSet = (id: string) => next.adSets.find((a) => a.id === id);
  const campaign = (id: string) => next.campaigns.find((c) => c.id === id);
  const ad = (id: string) => next.ads.find((a) => a.id === id);

  const markReset = (ids: string[]) => {
    for (const id of ids) {
      const a = adSet(id);
      if (a) {
        resetLearning(a, day);
        resets.add(id);
      }
    }
  };

  switch (edit.kind) {
    case 'setStatus': {
      const target =
        edit.level === 'campaign' ? campaign(edit.id)
        : edit.level === 'adset' ? adSet(edit.id)
        : ad(edit.id);
      if (!target) return { state, resetAdSetIds: [], error: 'That item no longer exists.' };
      target.status = edit.status;
      break;
    }

    case 'rename': {
      const target =
        edit.level === 'campaign' ? campaign(edit.id)
        : edit.level === 'adset' ? adSet(edit.id)
        : ad(edit.id);
      if (!target) return { state, resetAdSetIds: [], error: 'That item no longer exists.' };
      target.name = edit.name;
      break;
    }

    case 'setCampaignBudget': {
      const c = campaign(edit.id);
      if (!c) return { state, resetAdSetIds: [], error: 'That campaign no longer exists.' };
      if (c.budgetMode !== 'cbo') {
        return { state, resetAdSetIds: [], error: 'This campaign uses ad set budgets. Set the budget on each ad set instead.' };
      }
      markReset(previewReset(state, edit));
      c.dailyBudget = edit.dailyBudget;
      break;
    }

    case 'setAdSetBudget': {
      const a = adSet(edit.id);
      if (!a) return { state, resetAdSetIds: [], error: 'That ad set no longer exists.' };
      const parent = campaign(a.campaignId);
      if (parent?.budgetMode === 'cbo') {
        return { state, resetAdSetIds: [], error: 'This campaign uses Campaign Budget Optimization. Set the budget on the campaign.' };
      }
      markReset(previewReset(state, edit));
      a.dailyBudget = edit.dailyBudget;
      break;
    }

    case 'setBidStrategy': {
      const c = campaign(edit.id);
      if (!c) return { state, resetAdSetIds: [], error: 'That campaign no longer exists.' };
      c.bidStrategy = edit.bidStrategy;
      c.costCap = edit.bidStrategy === 'cost_cap' ? edit.costCap : undefined;
      break;
    }

    case 'setBudgetMode': {
      const c = campaign(edit.id);
      if (!c) return { state, resetAdSetIds: [], error: 'That campaign no longer exists.' };
      // Moving the budget between levels re-plans delivery for every ad set below.
      markReset(previewReset(state, edit));
      c.budgetMode = edit.budgetMode;
      if (edit.budgetMode === 'cbo') {
        // Roll the ad sets' budgets up so the campaign keeps spending what it did.
        const children = next.adSets.filter((a) => a.campaignId === c.id);
        c.dailyBudget = edit.dailyBudget
          ?? children.reduce((n, a) => n + (a.dailyBudget ?? 0), 0);
        for (const a of children) a.dailyBudget = undefined;
      } else {
        // ...and back down, split evenly, when returning to ad set budgets.
        const children = next.adSets.filter((a) => a.campaignId === c.id);
        const each = children.length > 0 ? (c.dailyBudget ?? 0) / children.length : 0;
        for (const a of children) a.dailyBudget = Math.round(each);
        c.dailyBudget = undefined;
      }
      break;
    }

    case 'setAudience': {
      const a = adSet(edit.id);
      if (!a) return { state, resetAdSetIds: [], error: 'That ad set no longer exists.' };
      if (!next.audiences.some((x) => x.id === edit.audienceId)) {
        return { state, resetAdSetIds: [], error: 'That audience no longer exists.' };
      }
      markReset([a.id]);
      a.audienceId = edit.audienceId;
      // Reach is a property of the pool, so pointing at a different pool means the
      // accumulated reach and frequency no longer describe anything real.
      a.runtime.reach = 0;
      a.runtime.impressions = 0;
      break;
    }

    case 'setOptimisationEvent': {
      const a = adSet(edit.id);
      if (!a) return { state, resetAdSetIds: [], error: 'That ad set no longer exists.' };
      markReset([a.id]);
      a.optimisationEvent = edit.optimisationEvent;
      break;
    }

    case 'setPlacements': {
      const a = adSet(edit.id);
      if (!a) return { state, resetAdSetIds: [], error: 'That ad set no longer exists.' };
      markReset([a.id]);
      a.advantagePlacements = edit.advantagePlacements;
      break;
    }

    case 'setAdCreative': {
      const target = ad(edit.id);
      if (!target) return { state, resetAdSetIds: [], error: 'That ad no longer exists.' };
      markReset([target.adSetId]);
      target.creativeId = edit.creativeId;
      target.format = edit.format;
      // A new creative has its own fatigue curve, so it starts fresh rather than
      // inheriting the impressions that wore the old one out.
      target.runtime = emptyAdRuntime();
      break;
    }

    case 'setAdCopy': {
      const target = ad(edit.id);
      if (!target) return { state, resetAdSetIds: [], error: 'That ad no longer exists.' };
      target.primaryText = edit.primaryText;
      target.headline = edit.headline;
      target.description = edit.description;
      target.cta = edit.cta;
      target.destinationUrl = edit.destinationUrl;
      break;
    }

    case 'createCampaign': {
      const c: SimCampaign = { ...edit.campaign, status: 'active', createdDay: day };
      next.campaigns.push(c);
      break;
    }

    case 'createAdSet': {
      if (!campaign(edit.adSet.campaignId)) {
        return { state, resetAdSetIds: [], error: 'That campaign no longer exists.' };
      }
      const a: SimAdSet = {
        ...edit.adSet, status: 'active', createdDay: day, runtime: emptyAdSetRuntime(day),
      };
      next.adSets.push(a);
      break;
    }

    case 'createAd': {
      if (!adSet(edit.ad.adSetId)) {
        return { state, resetAdSetIds: [], error: 'That ad set no longer exists.' };
      }
      const a: SimAd = { ...edit.ad, status: 'active', createdDay: day, runtime: emptyAdRuntime() };
      next.ads.push(a);
      break;
    }

    case 'createAudience': {
      next.audiences.push(edit.audience);
      break;
    }

    case 'duplicateAdSet': {
      const source = adSet(edit.id);
      if (!source) return { state, resetAdSetIds: [], error: 'That ad set no longer exists.' };

      // A duplicate is a brand-new ad set: it inherits the settings, never the
      // accumulated delivery. Copying the runtime would hand the learner a free
      // stabilised ad set and quietly undo the whole learning-phase lesson.
      const copy: SimAdSet = {
        ...structuredClone(source),
        id: edit.newId,
        name: edit.name,
        audienceId: edit.audienceId ?? source.audienceId,
        createdDay: day,
        status: 'active',
        runtime: emptyAdSetRuntime(day),
      };
      next.adSets.push(copy);

      const sourceAds = next.ads.filter((x) => x.adSetId === source.id);
      sourceAds.forEach((sourceAd, i) => {
        const newId = edit.newAdIds[i];
        if (!newId) return;
        next.ads.push({
          ...structuredClone(sourceAd),
          id: newId,
          adSetId: copy.id,
          createdDay: day,
          runtime: emptyAdRuntime(),
        });
      });
      break;
    }
  }

  return { state: next, resetAdSetIds: Array.from(resets) };
}
