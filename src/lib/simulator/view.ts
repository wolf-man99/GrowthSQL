/**
 * Turns simulator state into the rows the Ads Manager table renders.
 *
 * The dashboard already knows how to draw a `DisplayRow` — the frozen case study
 * has been feeding it for months. Rather than teach it a second data shape, this
 * adapter converts live simulator state plus a range of persisted day totals into
 * exactly the same rows, so both surfaces render and measure identically.
 *
 * Everything here is pure and synchronous: the totals are fetched by the caller
 * (account.ts owns the queries), and this only reshapes them.
 */

import type { DisplayRow, AudienceDisplay } from '@/components/meta/ads-manager/shared';
import { funnelFor, type MetricTotals } from './demo-account';
import { OBJECTIVE_LABEL, type SimAdSet, type SimState, type StrategyTag } from './engine/types';
import type { RangeTotals } from './account';

const EMPTY: MetricTotals = { spend: 0, revenue: 0, purchases: 0, impressions: 0, linkClicks: 0 };

/** Ads Manager's own wording for each delivery state. */
const DELIVERY_LABEL: Record<string, string> = {
  active: 'Active',
  learning: 'Learning',
  limited: 'Learning limited',
  paused: 'Off',
  not_delivering: 'Not delivering',
  archived: 'Archived',
};

/** Capitalised strategy label, matching the filter chips the table already uses. */
const STRATEGY_LABEL: Record<StrategyTag, string> = {
  prospecting: 'Prospecting',
  retargeting: 'Retargeting',
  catalog: 'Catalog',
};

function toMetric(t: RangeTotals | undefined): MetricTotals {
  if (!t) return { ...EMPTY };
  return {
    spend: t.spend, revenue: t.revenue, purchases: t.purchases,
    impressions: t.impressions, linkClicks: t.linkClicks,
  };
}

function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

/**
 * How an ad set's delivery reads in the table.
 *
 * A paused entity reports Off regardless of what its learning state was, matching
 * Ads Manager: you switched it off, so that is the fact that matters. The learning
 * state is preserved underneath and reappears when it is switched back on.
 */
function deliveryFor(adSet: SimAdSet, campaignPaused: boolean): string {
  if (campaignPaused || adSet.status !== 'active') return DELIVERY_LABEL.paused;
  return DELIVERY_LABEL[adSet.runtime.learningState] ?? DELIVERY_LABEL.active;
}

export interface BuildRowsInput {
  state: SimState;
  campaignTotals: Map<string, RangeTotals>;
  adSetTotals: Map<string, RangeTotals>;
  adTotals: Map<string, RangeTotals>;
}

export interface SimRows {
  campaigns: DisplayRow[];
  adSets: DisplayRow[];
  ads: DisplayRow[];
  audiences: AudienceDisplay[];
}

export function buildSimRows({ state, campaignTotals, adSetTotals, adTotals }: BuildRowsInput): SimRows {
  const campaignById = new Map(state.campaigns.map((c) => [c.id, c]));
  const adSetById = new Map(state.adSets.map((a) => [a.id, a]));
  const audienceById = new Map(state.audiences.map((a) => [a.id, a]));

  const campaigns: DisplayRow[] = state.campaigns.map((c) => {
    const t = toMetric(campaignTotals.get(c.id));
    const reach = campaignTotals.get(c.id)?.reach ?? 0;
    const children = state.adSets.filter((a) => a.campaignId === c.id);
    // A campaign has no delivery state of its own; it reports whether anything
    // beneath it is actually running, which is the question the column answers.
    const anyLive = c.status === 'active' && children.some((a) => a.status === 'active');
    return {
      id: c.id,
      entityId: c.id,
      name: c.name,
      subtitle: `${OBJECTIVE_LABEL[c.objective]} · ${c.budgetMode === 'cbo' ? 'Campaign budget' : 'Ad set budgets'}`,
      filterType: STRATEGY_LABEL[c.strategyTag],
      delivery: c.status !== 'active' ? DELIVERY_LABEL.paused : anyLive ? DELIVERY_LABEL.active : DELIVERY_LABEL.not_delivering,
      bidStrategyText: c.bidStrategy === 'cost_cap' ? `Cost cap ${inr(c.costCap ?? 0)}` : 'Highest volume',
      budgetText: c.budgetMode === 'cbo' ? `${inr(c.dailyBudget ?? 0)}/day` : 'Using ad set budgets',
      t,
      reach,
      funnel: funnelFor(c.strategyTag === 'retargeting' ? 'Retargeting' : c.strategyTag === 'catalog' ? 'Catalog' : 'Prospecting', t.purchases, t.linkClicks),
      paused: c.status !== 'active',
    };
  });

  const adSets: DisplayRow[] = state.adSets.map((a) => {
    const parent = campaignById.get(a.campaignId);
    const t = toMetric(adSetTotals.get(a.id));
    const reach = adSetTotals.get(a.id)?.reach ?? 0;
    const audience = audienceById.get(a.audienceId);
    const strategy = parent ? STRATEGY_LABEL[parent.strategyTag] : 'Prospecting';
    return {
      id: a.id,
      entityId: a.id,
      name: a.name,
      subtitle: audience ? `${audience.name} · ${audience.size.toLocaleString('en-IN')} people` : parent?.name ?? '',
      filterType: strategy,
      delivery: deliveryFor(a, parent?.status !== 'active'),
      bidStrategyText: parent?.bidStrategy === 'cost_cap' ? `Cost cap ${inr(parent.costCap ?? 0)}` : 'Highest volume',
      budgetText: parent?.budgetMode === 'cbo' ? 'Uses campaign budget' : `${inr(a.dailyBudget ?? 0)}/day`,
      t,
      reach,
      funnel: funnelFor(strategy as 'Prospecting' | 'Retargeting' | 'Catalog', t.purchases, t.linkClicks),
      paused: a.status !== 'active',
    };
  });

  const ads: DisplayRow[] = state.ads.map((ad) => {
    const parentSet = adSetById.get(ad.adSetId);
    const parentCampaign = parentSet ? campaignById.get(parentSet.campaignId) : undefined;
    const t = toMetric(adTotals.get(ad.id));
    const strategy = parentCampaign ? STRATEGY_LABEL[parentCampaign.strategyTag] : 'Prospecting';
    return {
      id: ad.id,
      entityId: ad.id,
      name: ad.name,
      subtitle: `${ad.format[0].toUpperCase()}${ad.format.slice(1)} · ${parentSet?.name ?? ''}`,
      filterType: strategy,
      delivery: ad.status !== 'active' ? DELIVERY_LABEL.paused
        : parentSet ? deliveryFor(parentSet, parentCampaign?.status !== 'active')
        : DELIVERY_LABEL.not_delivering,
      bidStrategyText: parentCampaign?.bidStrategy === 'cost_cap' ? `Cost cap ${inr(parentCampaign.costCap ?? 0)}` : 'Highest volume',
      budgetText: 'Uses ad set budget',
      t,
      // Reach is a property of the audience pool, which lives at the ad set, so an
      // ad has no reach of its own. Reporting the parent's would double-count it
      // across sibling ads, and reporting zero is the honest answer.
      reach: 0,
      funnel: funnelFor(strategy as 'Prospecting' | 'Retargeting' | 'Catalog', t.purchases, t.linkClicks),
      paused: ad.status !== 'active',
    };
  });

  const audiences: AudienceDisplay[] = state.audiences.map((aud) => {
    // An audience can be used by several ad sets, so its performance is the sum of
    // everywhere it is in play, not a single ad set's figures.
    const users = state.adSets.filter((a) => a.audienceId === aud.id);
    const t = users.reduce<MetricTotals>((acc, a) => {
      const m = toMetric(adSetTotals.get(a.id));
      return {
        spend: acc.spend + m.spend, revenue: acc.revenue + m.revenue, purchases: acc.purchases + m.purchases,
        impressions: acc.impressions + m.impressions, linkClicks: acc.linkClicks + m.linkClicks,
      };
    }, { ...EMPTY });
    const firstParent = users[0] ? campaignById.get(users[0].campaignId) : undefined;
    return {
      id: aud.id,
      name: aud.name,
      type: aud.type === 'lookalike' ? 'Lookalike Audience'
        : aud.type === 'custom' ? 'Custom Audience'
        : aud.type === 'dynamic' ? 'Dynamic (Catalog)'
        : 'Saved Audience',
      size: aud.size,
      adSetName: users.length === 1 ? users[0].name : users.length === 0 ? 'Not in use' : `${users.length} ad sets`,
      campaignName: firstParent?.name ?? '',
      t,
    };
  });

  return { campaigns, adSets, ads, audiences };
}

/** Account-level KPI strip for the active range. */
export function accountKpis(totals: RangeTotals) {
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const costPerResult = totals.purchases > 0 ? Math.round(totals.spend / totals.purchases) : 0;
  return { ...totals, roas, costPerResult };
}
