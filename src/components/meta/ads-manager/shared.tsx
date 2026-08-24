'use client';

import { GalleryHorizontal, Image as ImageIcon, LayoutGrid, Video } from 'lucide-react';
import {
  inr, cpm, cpc, ctr, costPerResult, campaignRoas,
  type MetricTotals, type FunnelCounts,
} from '@/lib/simulator/demo-account';

/**
 * The Ads Manager vocabulary, shared by both dashboards.
 *
 * Two things render this chrome: the frozen case-study viewer on the marketing
 * homepage (RunDashboard) and the live simulator inside the Run tier
 * (SimDashboard). They are genuinely different products — one is a fixed account
 * you read, the other is an account you operate over time — but they must look and
 * measure identically, or a learner would arrive at the real thing having built
 * muscle memory for a different tool.
 *
 * So the row shape, the column catalogue, the number formatting and the small
 * presentational pieces live here, and each dashboard owns only its own data
 * sourcing and interaction.
 */

// ───────────────────────────────────────────────────────────── formatting ──

export function pct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

export function num(n: number): string {
  return n.toLocaleString('en-IN');
}

export function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return num(n);
}

export function formatShort(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export const EMPTY_TOTALS: MetricTotals = { spend: 0, revenue: 0, purchases: 0, impressions: 0, linkClicks: 0 };

export type AdFormatLabel = 'Image' | 'Video' | 'Carousel' | 'Collection';

export const FORMAT_META: Record<AdFormatLabel, { icon: typeof ImageIcon; color: string }> = {
  Image: { icon: ImageIcon, color: '#f0a20d' },
  Video: { icon: Video, color: '#e0245e' },
  Carousel: { icon: GalleryHorizontal, color: '#1877f2' },
  Collection: { icon: LayoutGrid, color: '#31a24c' },
};

// ──────────────────────────────────────────────────────────────── the row ──

/**
 * A table row at whichever level is on screen (Campaign / Ad set / Ad).
 *
 * Level-specific fields (delivery, bid strategy, budget) are pre-rendered to text
 * by whoever builds the row, so one set of column renderers serves all three
 * levels without knowing which one it is looking at.
 */
export interface DisplayRow {
  id: string;
  name: string;
  subtitle: string;
  filterType: string;
  delivery: string;
  bidStrategyText: string;
  budgetText: string;
  t: MetricTotals;
  reach: number;
  funnel: FunnelCounts;
  highlight?: boolean;
  /** Simulator only: lets a row carry the actions available on it. */
  entityId?: string;
  paused?: boolean;
}

export interface ColumnDef {
  id: string;
  label: string;
  group: 'Performance' | 'Funnel';
  defaultOn: boolean;
  numeric: boolean;
  render: (r: DisplayRow) => string;
}

export const COLUMNS: ColumnDef[] = [
  { id: 'delivery', label: 'Delivery', group: 'Performance', defaultOn: true, numeric: false, render: (r) => r.delivery },
  { id: 'bidStrategy', label: 'Bid strategy', group: 'Performance', defaultOn: true, numeric: false, render: (r) => r.bidStrategyText },
  { id: 'budget', label: 'Budget', group: 'Performance', defaultOn: true, numeric: true, render: (r) => r.budgetText },
  { id: 'results', label: 'Results', group: 'Performance', defaultOn: true, numeric: true, render: (r) => num(r.t.purchases) },
  { id: 'reach', label: 'Reach', group: 'Performance', defaultOn: true, numeric: true, render: (r) => num(r.reach) },
  { id: 'impressions', label: 'Impressions', group: 'Performance', defaultOn: true, numeric: true, render: (r) => num(r.t.impressions) },
  { id: 'frequency', label: 'Frequency', group: 'Performance', defaultOn: false, numeric: true, render: (r) => (r.reach > 0 ? (r.t.impressions / r.reach).toFixed(2) : '–') },
  { id: 'cpm', label: 'CPM', group: 'Performance', defaultOn: true, numeric: true, render: (r) => (r.t.impressions > 0 ? inr(Math.round(cpm(r.t))) : '–') },
  { id: 'cpc', label: 'CPC (link)', group: 'Performance', defaultOn: true, numeric: true, render: (r) => (r.t.linkClicks > 0 ? inr(Math.round(cpc(r.t))) : '–') },
  { id: 'ctr', label: 'CTR (link)', group: 'Performance', defaultOn: true, numeric: true, render: (r) => (r.t.impressions > 0 ? pct(ctr(r.t)) : '–') },
  { id: 'linkClicks', label: 'Link clicks', group: 'Performance', defaultOn: false, numeric: true, render: (r) => num(r.t.linkClicks) },
  { id: 'costPerResult', label: 'Cost / result', group: 'Performance', defaultOn: true, numeric: true, render: (r) => (r.t.purchases > 0 ? inr(Math.round(costPerResult(r.t))) : '–') },
  { id: 'amountSpent', label: 'Amount spent', group: 'Performance', defaultOn: true, numeric: true, render: (r) => inr(r.t.spend) },
  { id: 'purchaseValue', label: 'Purchase value', group: 'Performance', defaultOn: false, numeric: true, render: (r) => inr(r.t.revenue) },
  { id: 'roas', label: 'Purchase ROAS', group: 'Performance', defaultOn: true, numeric: true, render: (r) => (r.t.spend > 0 && r.t.revenue > 0 ? `${campaignRoas(r.t).toFixed(2)}x` : '–') },
  { id: 'lpv', label: 'Landing page views', group: 'Funnel', defaultOn: false, numeric: true, render: (r) => num(r.funnel.landingPageViews) },
  { id: 'costPerLpv', label: 'Cost / landing page view', group: 'Funnel', defaultOn: false, numeric: true, render: (r) => (r.funnel.landingPageViews > 0 ? inr(Math.round(r.t.spend / r.funnel.landingPageViews)) : '–') },
  { id: 'atc', label: 'Adds to cart', group: 'Funnel', defaultOn: false, numeric: true, render: (r) => num(r.funnel.addToCart) },
  { id: 'costPerAtc', label: 'Cost / add to cart', group: 'Funnel', defaultOn: false, numeric: true, render: (r) => (r.funnel.addToCart > 0 ? inr(Math.round(r.t.spend / r.funnel.addToCart)) : '–') },
  { id: 'checkout', label: 'Checkouts initiated', group: 'Funnel', defaultOn: false, numeric: true, render: (r) => num(r.funnel.checkoutInitiated) },
  { id: 'costPerCheckout', label: 'Cost / checkout', group: 'Funnel', defaultOn: false, numeric: true, render: (r) => (r.funnel.checkoutInitiated > 0 ? inr(Math.round(r.t.spend / r.funnel.checkoutInitiated)) : '–') },
];

export const DEFAULT_COLUMNS = COLUMNS.filter((c) => c.defaultOn).map((c) => c.id);
export const FOOTER_SKIP = new Set(['delivery', 'bidStrategy', 'budget']);

/**
 * Groups already range-aggregated rows into buckets, for the Reporting breakdown.
 * Reuses each row's own totals rather than recomputing, so a breakdown always
 * reconciles to the account totals for the active range exactly.
 */
export function groupRows(
  rows: DisplayRow[],
  keyFn: (r: DisplayRow) => string,
): { key: string; t: MetricTotals; reach: number }[] {
  const map = new Map<string, { t: MetricTotals; reach: number }>();
  for (const r of rows) {
    const k = keyFn(r);
    const cur = map.get(k) ?? { t: { ...EMPTY_TOTALS }, reach: 0 };
    cur.t = {
      spend: cur.t.spend + r.t.spend, revenue: cur.t.revenue + r.t.revenue, purchases: cur.t.purchases + r.t.purchases,
      impressions: cur.t.impressions + r.t.impressions, linkClicks: cur.t.linkClicks + r.t.linkClicks,
    };
    cur.reach += r.reach;
    map.set(k, cur);
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
}

/** Sums a set of rows into the totals strip under the table. */
export function sumRows(rows: DisplayRow[]): { t: MetricTotals; reach: number; funnel: FunnelCounts } {
  const t = rows.reduce<MetricTotals>((a, r) => ({
    spend: a.spend + r.t.spend, revenue: a.revenue + r.t.revenue, purchases: a.purchases + r.t.purchases,
    impressions: a.impressions + r.t.impressions, linkClicks: a.linkClicks + r.t.linkClicks,
  }), { ...EMPTY_TOTALS });
  const reach = rows.reduce((n, r) => n + r.reach, 0);
  const funnel = rows.reduce<FunnelCounts>((a, r) => ({
    landingPageViews: a.landingPageViews + r.funnel.landingPageViews,
    addToCart: a.addToCart + r.funnel.addToCart,
    checkoutInitiated: a.checkoutInitiated + r.funnel.checkoutInitiated,
  }), { landingPageViews: 0, addToCart: 0, checkoutInitiated: 0 });
  return { t, reach, funnel };
}

// ─────────────────────────────────────────────────────── presentational ──

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-kpi">
      <div className="mb-kpi-l">{label}</div>
      <div className="mb-kpi-v">{value}</div>
    </div>
  );
}

/**
 * One table row.
 *
 * `onToggle` is what separates the two dashboards: the frozen viewer renders the
 * delivery switch as a decorative indicator, while the simulator wires it to a
 * real pause/resume. Passing nothing keeps the read-only behaviour.
 */
export function TableRow({
  row, columns, onToggle, editableColumns, onEditCell,
}: {
  row: DisplayRow;
  columns: ColumnDef[];
  onToggle?: (id: string, next: boolean) => void;
  /** Column ids this row allows editing in place, e.g. `['budget']`. */
  editableColumns?: Set<string>;
  onEditCell?: (columnId: string, row: DisplayRow) => void;
}) {
  const paused = row.paused ?? false;
  return (
    <tr className={row.highlight ? 'mb-row-new' : undefined} data-paused={paused || undefined}>
      <td>
        {onToggle ? (
          <button
            type="button"
            className="mb-toggle"
            data-off={paused || undefined}
            aria-label={paused ? `Resume ${row.name}` : `Pause ${row.name}`}
            aria-pressed={!paused}
            onClick={() => onToggle(row.entityId ?? row.id, paused)}
          />
        ) : (
          <span className="mb-toggle" role="img" aria-label="Delivery on" />
        )}
      </td>
      <td>
        <span className="mb-campaign-name">{row.name}</span>
        <span className="mb-campaign-type">{row.subtitle}</span>
      </td>
      {columns.map((col) => {
        const editable = Boolean(onEditCell && editableColumns?.has(col.id));
        return (
          <td key={col.id} className={col.numeric ? 'num' : undefined}>
            {editable ? (
              <button
                type="button"
                className="mb-cell-edit"
                onClick={() => onEditCell?.(col.id, row)}
                aria-label={`Edit ${col.label} for ${row.name}`}
              >
                {col.render(row)}
              </button>
            ) : (
              col.render(row)
            )}
          </td>
        );
      })}
    </tr>
  );
}

export interface AudienceDisplay {
  id: string;
  name: string;
  type: string;
  size: number;
  adSetName: string;
  campaignName: string;
  t: MetricTotals;
}

export function AudiencesPanel({ rows, footnote }: { rows: AudienceDisplay[]; footnote: string }) {
  return (
    <>
      <div className="mb-table-wrap">
        <table className="mb-table">
          <thead>
            <tr>
              <th>Audience</th>
              <th>Type</th>
              <th className="num">Estimated size</th>
              <th>Used in</th>
              <th className="num">Results</th>
              <th className="num">Amount spent</th>
              <th className="num">Cost / result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><span className="mb-campaign-name">{a.name}</span></td>
                <td>{a.type}</td>
                <td className="num">{compactNum(a.size)} people</td>
                <td>
                  <span className="mb-campaign-name" style={{ color: 'var(--m-ink)', fontWeight: 400 }}>{a.adSetName}</span>
                  <span className="mb-campaign-type">{a.campaignName}</span>
                </td>
                <td className="num">{num(a.t.purchases)}</td>
                <td className="num">{inr(a.t.spend)}</td>
                <td className="num">{a.t.purchases > 0 ? inr(Math.round(costPerResult(a.t))) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-footnote">{footnote}</p>
    </>
  );
}

export function ReportingPanel({
  groups, breakdown, onBreakdown, options,
}: {
  groups: { key: string; t: MetricTotals; reach: number }[];
  breakdown: string;
  onBreakdown: (b: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <>
      <div className="mb-toolbar">
        <div className="mb-filters">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={breakdown === o.key}
              onClick={() => onBreakdown(o.key)}
              className={breakdown === o.key ? 'mb-filter mb-filter-on' : 'mb-filter'}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-table-wrap">
        <table className="mb-table">
          <thead>
            <tr>
              <th>Breakdown</th>
              <th className="num">Amount spent</th>
              <th className="num">Impressions</th>
              <th className="num">Link clicks</th>
              <th className="num">CTR</th>
              <th className="num">Results</th>
              <th className="num">Cost / result</th>
              <th className="num">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <td><span className="mb-campaign-name">{g.key}</span></td>
                <td className="num">{inr(g.t.spend)}</td>
                <td className="num">{num(g.t.impressions)}</td>
                <td className="num">{num(g.t.linkClicks)}</td>
                <td className="num">{g.t.impressions > 0 ? pct(ctr(g.t)) : '–'}</td>
                <td className="num">{num(g.t.purchases)}</td>
                <td className="num">{g.t.purchases > 0 ? inr(Math.round(costPerResult(g.t))) : '–'}</td>
                <td className="num">{g.t.spend > 0 && g.t.revenue > 0 ? `${campaignRoas(g.t).toFixed(2)}x` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
