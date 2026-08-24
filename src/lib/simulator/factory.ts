/**
 * Builders for simulator state.
 *
 * Missions, the sandbox starting account, and the calibration script all need to
 * assemble campaigns, ad sets and ads without restating every default each time.
 * These keep that construction in one place so a change to the entity shape does
 * not have to be chased through a dozen scenario files.
 */

import {
  emptyAdRuntime,
  emptyAdSetRuntime,
  type AccountConditions,
  type AdFormat,
  type BidStrategy,
  type BudgetMode,
  type Objective,
  type OptimisationEvent,
  type SimAd,
  type SimAdSet,
  type SimAudience,
  type SimCampaign,
  type SimState,
  type StrategyTag,
} from './engine/types';

export const DEFAULT_CONDITIONS: AccountConditions = {
  aov: 900,
  landingPageQuality: 1,
  marketPressure: 1,
};

export function audience(
  id: string,
  name: string,
  size: number,
  warmth: number,
  extra: Partial<SimAudience> = {},
): SimAudience {
  return { id, name, size, warmth, type: 'saved', ...extra };
}

export function campaign(
  id: string,
  name: string,
  opts: Partial<SimCampaign> = {},
): SimCampaign {
  return {
    id,
    name,
    objective: 'sales' as Objective,
    budgetMode: 'abo' as BudgetMode,
    bidStrategy: 'highest_volume' as BidStrategy,
    status: 'active',
    strategyTag: 'prospecting' as StrategyTag,
    createdDay: 0,
    ...opts,
  };
}

export function adSet(
  id: string,
  campaignId: string,
  name: string,
  audienceId: string,
  opts: Partial<SimAdSet> = {},
): SimAdSet {
  const createdDay = opts.createdDay ?? 0;
  return {
    id,
    campaignId,
    name,
    audienceId,
    optimisationEvent: 'purchase' as OptimisationEvent,
    advantagePlacements: true,
    status: 'active',
    createdDay,
    runtime: emptyAdSetRuntime(createdDay),
    ...opts,
  };
}

export function ad(
  id: string,
  adSetId: string,
  name: string,
  creativeId: string,
  opts: Partial<SimAd> = {},
): SimAd {
  return {
    id,
    adSetId,
    name,
    creativeId,
    format: 'image' as AdFormat,
    primaryText: '',
    headline: '',
    description: '',
    cta: 'Shop now',
    destinationUrl: 'https://northbound.example/shop',
    status: 'active',
    createdDay: 0,
    runtime: emptyAdRuntime(),
    ...opts,
  };
}

export function state(parts: Partial<SimState> = {}): SimState {
  return {
    day: 0,
    conditions: { ...DEFAULT_CONDITIONS },
    audiences: [],
    campaigns: [],
    adSets: [],
    ads: [],
    ...parts,
  };
}
