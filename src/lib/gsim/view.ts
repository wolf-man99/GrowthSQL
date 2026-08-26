/**
 * Turning simulated days into the tables Google Ads actually shows.
 *
 * Pure functions over `GDayResult[]`, deliberately kept out of the components.
 * Every number the dashboard displays is derived here from days the engine
 * produced, so a figure on screen can always be traced to auctions that happened
 * rather than to something a component computed on the way past.
 *
 * The derived metrics — CTR, CPC, conversion rate, cost per conversion, ROAS,
 * impression share — are computed in one place for the same reason. Two components
 * each doing their own division is two chances to divide by a different
 * denominator, and a learner comparing a keyword row against a campaign row would
 * have no way to tell which one was lying.
 */

import type {
  AppChannelRow, AppDayResult, GDayMetrics, GDayResult, GState, KeywordDayResult,
  PmaxInsightRow,
} from './engine/types';

/** What every table in the dashboard sums to. An alias rather than a new shape,
 *  because a total of days is exactly one day's metrics with bigger numbers in it. */
export type Totals = GDayMetrics;

export function emptyTotals(): Totals {
  return { impressions: 0, clicks: 0, cost: 0, conversions: 0, convValue: 0 };
}

export function addMetrics(a: Totals, b: GDayMetrics): Totals {
  a.impressions += b.impressions;
  a.clicks += b.clicks;
  a.cost += b.cost;
  a.conversions += b.conversions;
  a.convValue += b.convValue;
  return a;
}

// ───────────────────────────────────────────────────────── derived metrics ──

export const ctr = (t: GDayMetrics) => (t.impressions > 0 ? t.clicks / t.impressions : 0);
export const cpc = (t: GDayMetrics) => (t.clicks > 0 ? t.cost / t.clicks : 0);
export const cvr = (t: GDayMetrics) => (t.clicks > 0 ? t.conversions / t.clicks : 0);
export const cpa = (t: GDayMetrics) => (t.conversions > 0 ? t.cost / t.conversions : 0);
export const roas = (t: GDayMetrics) => (t.cost > 0 ? t.convValue / t.cost : 0);

/** Rupees, the way an Indian ads interface writes them. */
export function inr(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })}`;
}

export function pct(n: number, digits = 2): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function count(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

// ─────────────────────────────────────────────────────────── date windows ──

export interface DayWindow {
  /** Inclusive, in simulated days. */
  from: number;
  to: number;
  label: string;
}

/** The ranges the picker offers, given how long the account has been running. */
export function windowsFor(currentDay: number): DayWindow[] {
  const last = Math.max(0, currentDay - 1);
  const window = (days: number, label: string): DayWindow => ({
    from: Math.max(0, last - days + 1), to: last, label,
  });
  const out: DayWindow[] = [window(7, 'Last 7 days')];
  if (currentDay > 7) out.push(window(14, 'Last 14 days'));
  if (currentDay > 14) out.push(window(30, 'Last 30 days'));
  out.push({ from: 0, to: last, label: 'All time' });
  if (currentDay > 0) out.push({ from: last, to: last, label: 'Yesterday' });
  return out;
}

export function inWindow(days: GDayResult[], w: DayWindow): GDayResult[] {
  return days.filter((d) => d.day >= w.from && d.day <= w.to);
}

// ────────────────────────────────────────────────────────────────── rows ──

export interface CampaignRow extends Totals {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  status: string;
  bidStrategyLabel: string;
  dailyBudget: number;
  /** True on any day in the window the campaign ran out of money. */
  budgetCappedDays: number;
  /** App campaigns only. */
  installs?: number;
  blocked?: string;
}

export interface KeywordRow extends Totals {
  id: string;
  text: string;
  match: string;
  display: string;
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  maxCpc?: number;
  /** Impression-weighted across the window, which is how Google reports it. */
  qualityScore: number;
  qualityDetail: KeywordDayResult['qualityDetail'];
  state: string;
  eligible: number;
  lostToRank: number;
  lostToBudget: number;
  topImpressions: number;
  absTopImpressions: number;
}

export interface TermRow extends Totals {
  queryId: string;
  text: string;
  keywordId: string;
  keywordText: string;
  campaignId: string;
  campaignName: string;
  /** Already negated somewhere that applies to it. */
  excluded: boolean;
}

/** Share of eligible auctions actually won. The metric the whole diagnostic
 *  vocabulary of Google Ads is built on. */
export const impressionShare = (r: { impressions: number; eligible: number }) =>
  (r.eligible > 0 ? r.impressions / r.eligible : 0);

export const lostToRankShare = (r: { lostToRank: number; eligible: number }) =>
  (r.eligible > 0 ? r.lostToRank / r.eligible : 0);

export const lostToBudgetShare = (r: { lostToBudget: number; eligible: number }) =>
  (r.eligible > 0 ? r.lostToBudget / r.eligible : 0);

export const topShare = (r: { topImpressions: number; impressions: number }) =>
  (r.impressions > 0 ? r.topImpressions / r.impressions : 0);

export const absTopShare = (r: { absTopImpressions: number; impressions: number }) =>
  (r.impressions > 0 ? r.absTopImpressions / r.impressions : 0);

// ──────────────────────────────────────────────────────────── aggregation ──

const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  search: 'Search',
  pmax: 'Performance Max',
  app: 'App',
  shopping: 'Shopping',
};

const BID_LABEL: Record<string, string> = {
  manual_cpc: 'Manual CPC',
  maximise_clicks: 'Maximise clicks',
  maximise_conversions: 'Maximise conversions',
  target_cpa: 'Target CPA',
  target_roas: 'Target ROAS',
};

const MATCH_DISPLAY: Record<string, (t: string) => string> = {
  exact: (t) => `[${t}]`,
  phrase: (t) => `"${t}"`,
  broad: (t) => t,
};

export function campaignRows(state: GState, days: GDayResult[]): CampaignRow[] {
  const byId = new Map<string, CampaignRow>();

  for (const c of state.campaigns) {
    if (c.status === 'removed') continue;
    byId.set(c.id, {
      ...emptyTotals(),
      id: c.id,
      name: c.name,
      type: c.type,
      typeLabel: CAMPAIGN_TYPE_LABEL[c.type] ?? c.type,
      status: c.status,
      bidStrategyLabel: bidLabelFor(c.bidStrategy, c.targetCpa, c.targetRoas),
      dailyBudget: c.dailyBudget,
      budgetCappedDays: 0,
      installs: c.type === 'app' ? 0 : undefined,
    });
  }

  for (const d of days) {
    for (const c of d.campaigns) {
      const row = byId.get(c.campaignId);
      if (!row) continue;
      addMetrics(row, c);
      if (c.budgetCapped) row.budgetCappedDays++;
    }
    for (const a of d.apps) {
      const row = byId.get(a.campaignId);
      if (!row) continue;
      row.installs = (row.installs ?? 0) + a.installs;
      if (a.blocked) row.blocked = a.blocked;
    }
  }

  return [...byId.values()].sort((a, b) => b.cost - a.cost);
}

function bidLabelFor(strategy: string, targetCpa?: number, targetRoas?: number): string {
  const base = BID_LABEL[strategy] ?? strategy;
  if (strategy === 'target_cpa' && targetCpa) return `${base} · ${inr(targetCpa)}`;
  if (strategy === 'target_roas' && targetRoas) return `${base} · ${Math.round(targetRoas * 100)}%`;
  return base;
}

export function keywordRows(state: GState, days: GDayResult[], campaignId?: string): KeywordRow[] {
  const groupById = new Map(state.adGroups.map((g) => [g.id, g]));
  const campaignById = new Map(state.campaigns.map((c) => [c.id, c]));
  const byId = new Map<string, KeywordRow & { qsWeighted: number; qsWeight: number }>();

  for (const k of state.keywords) {
    if (k.status === 'removed') continue;
    const group = groupById.get(k.adGroupId);
    if (!group) continue;
    const campaign = campaignById.get(group.campaignId);
    if (!campaign) continue;
    if (campaignId && campaign.id !== campaignId) continue;

    byId.set(k.id, {
      ...emptyTotals(),
      id: k.id,
      text: k.text,
      match: k.match,
      display: (MATCH_DISPLAY[k.match] ?? ((t: string) => t))(k.text),
      adGroupId: group.id,
      adGroupName: group.name,
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: k.status,
      maxCpc: k.maxCpc,
      qualityScore: 0,
      qualityDetail: { expectedCtr: 'average', adRelevance: 'average', landingPage: 'average' },
      state: k.runtime.state,
      eligible: 0, lostToRank: 0, lostToBudget: 0,
      topImpressions: 0, absTopImpressions: 0,
      qsWeighted: 0, qsWeight: 0,
    });
  }

  for (const d of days) {
    for (const k of d.keywords) {
      const row = byId.get(k.keywordId);
      if (!row) continue;
      addMetrics(row, k);
      row.eligible += k.eligible;
      row.lostToRank += k.lostToRank;
      row.lostToBudget += k.lostToBudget;
      row.topImpressions += k.topImpressions;
      row.absTopImpressions += k.absTopImpressions;
      // Weighted by the day's auctions rather than averaged flat: a keyword that
      // entered forty thousand auctions on Tuesday and eleven on Sunday should not
      // report the mean of two numbers as though the days were comparable.
      if (k.qualityScore > 0 && k.eligible > 0) {
        row.qsWeighted += k.qualityScore * k.eligible;
        row.qsWeight += k.eligible;
        row.qualityDetail = k.qualityDetail;
      }
    }
  }

  return [...byId.values()]
    .map(({ qsWeighted, qsWeight, ...row }) => ({
      ...row,
      qualityScore: qsWeight > 0 ? Math.round(qsWeighted / qsWeight) : 0,
    }))
    .sort((a, b) => b.cost - a.cost);
}

/**
 * The search terms report.
 *
 * The one table the Google Ads course revolves around, and the only place a
 * learner can see what they actually bought as opposed to what they asked for.
 * `excluded` marks terms a negative already blocks, so the interface can show a
 * learner that their last change worked rather than making them infer it from an
 * absence.
 */
export function termRows(state: GState, days: GDayResult[], campaignId?: string): TermRow[] {
  const keywordById = new Map(state.keywords.map((k) => [k.id, k]));
  const campaignById = new Map(state.campaigns.map((c) => [c.id, c]));
  const byKey = new Map<string, TermRow>();

  for (const d of days) {
    for (const t of d.searchTerms) {
      if (campaignId && t.campaignId !== campaignId) continue;
      const key = `${t.queryId}|${t.keywordId}`;
      let row = byKey.get(key);
      if (!row) {
        row = {
          ...emptyTotals(),
          queryId: t.queryId,
          text: t.text,
          keywordId: t.keywordId,
          keywordText: keywordById.get(t.keywordId)?.text ?? '—',
          campaignId: t.campaignId,
          campaignName: campaignById.get(t.campaignId)?.name ?? '—',
          excluded: false,
        };
        byKey.set(key, row);
      }
      addMetrics(row, t);
    }
  }

  return [...byKey.values()].sort((a, b) => b.cost - a.cost);
}

/** Performance Max's categories, which is all it will tell you. */
export function pmaxRows(days: GDayResult[], campaignId: string): (PmaxInsightRow & Totals)[] {
  const byCategory = new Map<string, PmaxInsightRow>();
  for (const d of days) {
    for (const r of d.pmaxInsights) {
      if (r.campaignId !== campaignId) continue;
      let row = byCategory.get(r.category);
      if (!row) {
        row = { ...emptyTotals(), campaignId, category: r.category };
        byCategory.set(r.category, row);
      }
      addMetrics(row, r);
    }
  }
  return [...byCategory.values()].sort((a, b) => b.cost - a.cost);
}

/** One channel's whole window. Same shape as a single day's row — a channel that
 *  ran for thirty days is not a different kind of thing from one that ran for one. */
export type AppChannelTotals = AppChannelRow;

/** An App campaign's channel split, which is the only breakdown it offers and the
 *  only one that explains where the installs came from. */
export function appChannelRows(days: GDayResult[], campaignId: string): AppChannelTotals[] {
  const byChannel = new Map<string, AppChannelTotals>();
  for (const d of days) {
    for (const a of d.apps) {
      if (a.campaignId !== campaignId) continue;
      for (const ch of a.channels) {
        let row = byChannel.get(ch.channelId);
        if (!row) {
          row = { ...emptyTotals(), channelId: ch.channelId, label: ch.label, installs: 0, events: 0 };
          byChannel.set(ch.channelId, row);
        }
        addMetrics(row, ch);
        row.installs += ch.installs;
        row.events += ch.events;
      }
    }
  }
  return [...byChannel.values()].sort((a, b) => b.cost - a.cost);
}

export function appTotals(days: GDayResult[], campaignId: string): AppDayResult {
  const out: AppDayResult = {
    ...emptyTotals(), campaignId, installs: 0, events: 0, channels: [],
    budget: 0, budgetCapped: false,
  };
  for (const d of days) {
    for (const a of d.apps) {
      if (a.campaignId !== campaignId) continue;
      addMetrics(out, a);
      out.installs += a.installs;
      out.events += a.events;
      out.budget = a.budget;
      if (a.budgetCapped) out.budgetCapped = true;
      if (a.blocked) out.blocked = a.blocked;
    }
  }
  return out;
}

export function accountTotals(days: GDayResult[]): Totals {
  return days.reduce((acc, d) => addMetrics(acc, d.account), emptyTotals());
}

/** The daily series behind the chart, so the line and the table cannot disagree. */
export function dailySeries(days: GDayResult[]): { day: number; metrics: Totals }[] {
  return days.map((d) => ({ day: d.day, metrics: { ...d.account } }));
}
