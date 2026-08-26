/**
 * Building and editing a Google Ads account.
 *
 * Two jobs: terse constructors so a scenario file reads like an account rather
 * than like JSON, and one `applyEdit` choke point so that every change a learner
 * makes goes through the same place — including the changes that cost something.
 *
 * That second job is the important one. On Google, editing a bid strategy or a
 * target restarts a learning period, and the reason accounts get stuck is that
 * people change targets weekly and never let one stabilise long enough to judge.
 * If edits were applied directly to state, that lesson would have nowhere to live.
 */

import {
  emptyCampaignRuntime, emptyKeywordRuntime, emptyAdRuntime,
  type GAd, type GAdGroup, type GBidStrategy, type GCampaign, type GCampaignType,
  type GKeyword, type GNegative, type GState, type MatchType,
} from './engine/types';
import { VERTICALS, type VerticalId } from './verticals';

// ────────────────────────────────────────────────────────────── constructors ──

export function campaign(init: {
  id: string;
  name: string;
  type?: GCampaignType;
  dailyBudget: number;
  bidStrategy?: GBidStrategy;
  targetCpa?: number;
  targetRoas?: number;
  pmaxReach?: number;
  status?: GCampaign['status'];
  createdDay?: number;
}): GCampaign {
  const createdDay = init.createdDay ?? 0;
  return {
    id: init.id,
    name: init.name,
    type: init.type ?? 'search',
    dailyBudget: init.dailyBudget,
    bidStrategy: init.bidStrategy ?? 'manual_cpc',
    targetCpa: init.targetCpa,
    targetRoas: init.targetRoas,
    pmaxReach: init.pmaxReach,
    status: init.status ?? 'active',
    createdDay,
    runtime: emptyCampaignRuntime(createdDay),
  };
}

export function adGroup(init: {
  id: string;
  campaignId: string;
  name: string;
  defaultCpc?: number;
  /** 0.6 is one homepage for everything; 1.25 is a page per theme. */
  landingPageQuality?: number;
  status?: GAdGroup['status'];
  createdDay?: number;
}): GAdGroup {
  return {
    id: init.id,
    campaignId: init.campaignId,
    name: init.name,
    defaultCpc: init.defaultCpc,
    landingPageQuality: init.landingPageQuality ?? 0.9,
    status: init.status ?? 'active',
    createdDay: init.createdDay ?? 0,
  };
}

export function keyword(init: {
  id: string;
  adGroupId: string;
  text: string;
  match: MatchType;
  maxCpc?: number;
  status?: GKeyword['status'];
  createdDay?: number;
}): GKeyword {
  return {
    id: init.id,
    adGroupId: init.adGroupId,
    text: init.text,
    match: init.match,
    maxCpc: init.maxCpc,
    status: init.status ?? 'active',
    createdDay: init.createdDay ?? 0,
    runtime: emptyKeywordRuntime(),
  };
}

export function negative(init: {
  id: string;
  level: GNegative['level'];
  ownerId?: string;
  text: string;
  match?: MatchType;
}): GNegative {
  return {
    id: init.id,
    level: init.level,
    ownerId: init.ownerId,
    text: init.text,
    match: init.match ?? 'phrase',
  };
}

export function ad(init: {
  id: string;
  adGroupId: string;
  headlines: string[];
  descriptions?: string[];
  finalUrl?: string;
  status?: GAd['status'];
  createdDay?: number;
}): GAd {
  return {
    id: init.id,
    adGroupId: init.adGroupId,
    headlines: init.headlines,
    descriptions: init.descriptions ?? [],
    finalUrl: init.finalUrl ?? '/',
    status: init.status ?? 'active',
    createdDay: init.createdDay ?? 0,
    runtime: emptyAdRuntime(),
  };
}

/** An empty account in a given market, ready for campaigns to be added. */
export function accountFor(vertical: VerticalId): GState {
  const v = VERTICALS[vertical];
  return {
    day: 0,
    conditions: { ...v.conditions },
    queries: v.queries,
    campaigns: [],
    adGroups: [],
    keywords: [],
    negatives: [],
    ads: [],
  };
}

// ───────────────────────────────────────────────────────────────────── edits ──

export type GEdit =
  | { kind: 'campaign_status'; id: string; status: GCampaign['status'] }
  | { kind: 'campaign_budget'; id: string; dailyBudget: number }
  | { kind: 'campaign_bid_strategy'; id: string; bidStrategy: GBidStrategy; targetCpa?: number; targetRoas?: number }
  | { kind: 'campaign_pmax_reach'; id: string; pmaxReach: number }
  | { kind: 'adgroup_status'; id: string; status: GAdGroup['status'] }
  | { kind: 'adgroup_cpc'; id: string; defaultCpc: number }
  | { kind: 'adgroup_landing_page'; id: string; landingPageQuality: number }
  | { kind: 'keyword_status'; id: string; status: GKeyword['status'] }
  | { kind: 'keyword_bid'; id: string; maxCpc: number }
  | { kind: 'keyword_match'; id: string; match: MatchType }
  | { kind: 'add_campaign'; campaign: GCampaign }
  | { kind: 'add_adgroup'; adGroup: GAdGroup }
  | { kind: 'add_keyword'; keyword: GKeyword }
  | { kind: 'add_ad'; ad: GAd }
  | { kind: 'add_negative'; negative: GNegative }
  | { kind: 'remove_negative'; id: string };

export interface EditResult {
  state: GState;
  /** True when the edit restarted a bid strategy's learning period. Surfaced in
   *  the interface, because an edit whose cost is invisible teaches nothing. */
  resetLearning: boolean;
  /** Human-readable, for the change log the dashboard shows. */
  note: string;
}

/**
 * Apply one edit.
 *
 * The `resetLearning` half is the point. Google restarts a Smart Bidding learning
 * period when the strategy changes, when a target moves materially, or when a
 * campaign's budget moves a long way — and while it re-learns, performance is
 * genuinely worse. A learner who changes their target CPA every three days will
 * watch an account that never stabilises, and the interface will tell them why.
 */
export function applyEdit(state: GState, edit: GEdit, day: number): EditResult {
  const next: GState = structuredClone(state);
  let resetLearning = false;
  let note = '';

  const findCampaign = (id: string) => next.campaigns.find((c) => c.id === id);
  const findGroup = (id: string) => next.adGroups.find((g) => g.id === id);
  const findKeyword = (id: string) => next.keywords.find((k) => k.id === id);

  switch (edit.kind) {
    case 'campaign_status': {
      const c = findCampaign(edit.id);
      if (c) { c.status = edit.status; note = `${c.name} ${edit.status}`; }
      break;
    }
    case 'campaign_budget': {
      const c = findCampaign(edit.id);
      if (c) {
        const before = c.dailyBudget;
        c.dailyBudget = edit.dailyBudget;
        note = `${c.name} budget ₹${before} → ₹${edit.dailyBudget}`;
        // A budget change large enough to change what the strategy is optimising
        // against restarts learning. Small steps do not, which is exactly why
        // scaling in 20% increments works and doubling overnight does not.
        if (before > 0 && Math.abs(edit.dailyBudget - before) / before > 0.3) {
          c.runtime.strategyChangedDay = day;
          resetLearning = true;
        }
      }
      break;
    }
    case 'campaign_bid_strategy': {
      const c = findCampaign(edit.id);
      if (c) {
        const changed = c.bidStrategy !== edit.bidStrategy
          || (edit.targetCpa !== undefined && edit.targetCpa !== c.targetCpa)
          || (edit.targetRoas !== undefined && edit.targetRoas !== c.targetRoas);
        note = `${c.name} → ${edit.bidStrategy}`;
        c.bidStrategy = edit.bidStrategy;
        if (edit.targetCpa !== undefined) c.targetCpa = edit.targetCpa;
        if (edit.targetRoas !== undefined) c.targetRoas = edit.targetRoas;
        if (changed) { c.runtime.strategyChangedDay = day; resetLearning = true; }
      }
      break;
    }
    case 'campaign_pmax_reach': {
      const c = findCampaign(edit.id);
      if (c) { c.pmaxReach = edit.pmaxReach; note = `${c.name} reach → ${edit.pmaxReach}`; }
      break;
    }
    case 'adgroup_status': {
      const g = findGroup(edit.id);
      if (g) { g.status = edit.status; note = `${g.name} ${edit.status}`; }
      break;
    }
    case 'adgroup_cpc': {
      const g = findGroup(edit.id);
      if (g) { g.defaultCpc = edit.defaultCpc; note = `${g.name} default CPC → ₹${edit.defaultCpc}`; }
      break;
    }
    case 'adgroup_landing_page': {
      const g = findGroup(edit.id);
      if (g) {
        g.landingPageQuality = edit.landingPageQuality;
        note = `${g.name} landing page updated`;
      }
      break;
    }
    case 'keyword_status': {
      const k = findKeyword(edit.id);
      if (k) { k.status = edit.status; note = `${k.text} ${edit.status}`; }
      break;
    }
    case 'keyword_bid': {
      const k = findKeyword(edit.id);
      if (k) { k.maxCpc = edit.maxCpc; note = `${k.text} bid → ₹${edit.maxCpc}`; }
      break;
    }
    case 'keyword_match': {
      const k = findKeyword(edit.id);
      if (k) { k.match = edit.match; note = `${k.text} → ${edit.match}`; }
      break;
    }
    case 'add_campaign':
      next.campaigns.push(edit.campaign);
      note = `Created ${edit.campaign.name}`;
      break;
    case 'add_adgroup':
      next.adGroups.push(edit.adGroup);
      note = `Created ${edit.adGroup.name}`;
      break;
    case 'add_keyword':
      next.keywords.push(edit.keyword);
      note = `Added ${edit.keyword.text}`;
      break;
    case 'add_ad':
      next.ads.push(edit.ad);
      note = 'Added ad';
      break;
    case 'add_negative':
      next.negatives.push(edit.negative);
      note = `Negative: ${edit.negative.text}`;
      break;
    case 'remove_negative':
      next.negatives = next.negatives.filter((n) => n.id !== edit.id);
      note = 'Removed negative';
      break;
  }

  return { state: next, resetLearning, note };
}

export function applyEdits(state: GState, edits: GEdit[], day: number): GState {
  return edits.reduce((s, e) => applyEdit(s, e, day).state, state);
}
