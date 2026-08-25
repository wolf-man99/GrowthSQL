/**
 * Breakdowns: the same delivery, split by who saw it and where.
 *
 * Being straight about what this is. The engine models delivery at ad set level,
 * not per demographic segment, so these splits are a *modelled attribution* of
 * totals that were really produced, not a measurement of segments that were really
 * tracked. The UI says so in as many words, because a fabricated age breakdown
 * presented as measurement would teach a learner to trust a number that is not
 * there.
 *
 * What makes it worth having anyway: the weights are derived from each audience's
 * own targeting spec, deterministically, so they are consistent across days and
 * ranges, they always reconcile to the total, and they move when the learner
 * changes who they target. A learner reading "Reels is carrying this ad set"
 * learns something true about the audience they built.
 */

import type { MetricTotals } from './demo-account';
import { mulberry32, stringSeed } from './engine/rng';
import type { SimAudience } from './engine/types';

export type BreakdownKind = 'age' | 'gender' | 'placement';

export interface BreakdownRow {
  key: string;
  t: MetricTotals;
  /** Share of the parent's impressions, for the bar in the table. */
  share: number;
}

const AGE_BANDS = ['18–24', '25–34', '35–44', '45–54', '55+'] as const;
const PLACEMENTS = ['Facebook Feed', 'Instagram Feed', 'Instagram Reels', 'Stories', 'Audience Network'] as const;

/**
 * Age weights for an audience, from its targeting spec.
 *
 * A spec that excludes a band gives it zero, which is the property that makes this
 * feel real: narrow the age range on an ad set and the breakdown narrows with it.
 * Within the permitted bands, younger skews heavier, matching where the attention
 * actually is on these platforms.
 */
function ageWeights(audience: SimAudience): number[] {
  const spec = audience.spec;
  const min = spec?.ageMin ?? 18;
  const max = spec?.ageMax ?? 65;
  const bandRanges: [number, number][] = [[18, 24], [25, 34], [35, 44], [45, 54], [55, 99]];
  const base = [1.25, 1.4, 1.0, 0.7, 0.45];
  return bandRanges.map(([lo, hi], i) => {
    const overlaps = hi >= min && lo <= max;
    return overlaps ? base[i] : 0;
  });
}

function genderWeights(audience: SimAudience): number[] {
  const g = audience.spec?.genders ?? 'all';
  if (g === 'men') return [1, 0];
  if (g === 'women') return [0, 1];
  return [0.94, 1.06];
}

/**
 * Placement weights, shifted by how warm the audience is.
 *
 * Cold prospecting lands disproportionately in Reels, where cheap reach lives;
 * warm retargeting concentrates in Feed, where people who already know the brand
 * are more likely to be browsing deliberately. Audience Network is always the
 * cheap tail nobody wants but everyone gets some of.
 */
function placementWeights(audience: SimAudience): number[] {
  const warm = Math.min(1, Math.max(0, audience.warmth));
  return [
    0.9 + warm * 0.5,   // Facebook Feed
    1.0 + warm * 0.3,   // Instagram Feed
    1.5 - warm * 0.7,   // Instagram Reels
    0.8 - warm * 0.15,  // Stories
    0.45 - warm * 0.25, // Audience Network
  ].map((w) => Math.max(0.05, w));
}

/**
 * Splits totals across a set of weights so the parts sum back to the whole.
 *
 * Integer fields use largest-remainder so nothing is lost to rounding: a breakdown
 * whose rows do not add up to the row above it is worse than no breakdown, because
 * it makes a learner distrust numbers that were correct.
 */
function split(t: MetricTotals, weights: number[], seed: number): MetricTotals[] {
  const rng = mulberry32(seed);
  // A little jitter so segments are not suspiciously proportional to each other,
  // seeded so the same account always shows the same split.
  const jittered = weights.map((w) => (w <= 0 ? 0 : w * (0.9 + rng() * 0.2)));
  const total = jittered.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => ({ spend: 0, revenue: 0, purchases: 0, impressions: 0, linkClicks: 0 }));

  const shares = jittered.map((w) => w / total);

  const distribute = (value: number): number[] => {
    const raw = shares.map((s) => s * value);
    const floors = raw.map(Math.floor);
    let remainder = value - floors.reduce((a, b) => a + b, 0);
    const order = raw
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    const out = floors.slice();
    for (let k = 0; k < order.length && remainder > 0; k++, remainder--) out[order[k].i]++;
    return out;
  };

  const spend = distribute(t.spend);
  const revenue = distribute(t.revenue);
  const purchases = distribute(t.purchases);
  const impressions = distribute(t.impressions);
  const linkClicks = distribute(t.linkClicks);

  return shares.map((_, i) => ({
    spend: spend[i], revenue: revenue[i], purchases: purchases[i],
    impressions: impressions[i], linkClicks: linkClicks[i],
  }));
}

export function breakdownFor(
  kind: BreakdownKind,
  totals: MetricTotals,
  audience: SimAudience,
  seed: number,
): BreakdownRow[] {
  const labels = kind === 'age' ? [...AGE_BANDS] : kind === 'gender' ? ['Men', 'Women'] : [...PLACEMENTS];
  const weights =
    kind === 'age' ? ageWeights(audience)
    : kind === 'gender' ? genderWeights(audience)
    : placementWeights(audience);

  const parts = split(totals, weights, seed ^ stringSeed(`${kind}:${audience.id}`));
  const impressionTotal = parts.reduce((n, p) => n + p.impressions, 0);

  return labels
    .map((key, i) => ({
      key,
      t: parts[i],
      share: impressionTotal > 0 ? parts[i].impressions / impressionTotal : 0,
    }))
    // A band the targeting excludes should not appear at all, rather than as a
    // row of zeroes a learner has to wonder about.
    .filter((r) => r.t.impressions > 0 || r.share > 0);
}

/**
 * Aggregates a breakdown across several audiences.
 *
 * Used for the account-level view, where each ad set's totals are split by its own
 * audience's weights and then summed by segment, so an account targeting one
 * narrow age band and one broad one shows the honest blend of the two.
 */
export function combineBreakdowns(rows: BreakdownRow[][]): BreakdownRow[] {
  const map = new Map<string, MetricTotals>();
  for (const set of rows) {
    for (const r of set) {
      const cur = map.get(r.key) ?? { spend: 0, revenue: 0, purchases: 0, impressions: 0, linkClicks: 0 };
      map.set(r.key, {
        spend: cur.spend + r.t.spend, revenue: cur.revenue + r.t.revenue,
        purchases: cur.purchases + r.t.purchases, impressions: cur.impressions + r.t.impressions,
        linkClicks: cur.linkClicks + r.t.linkClicks,
      });
    }
  }
  const total = Array.from(map.values()).reduce((n, t) => n + t.impressions, 0);
  return Array.from(map.entries())
    .map(([key, t]) => ({ key, t, share: total > 0 ? t.impressions / total : 0 }))
    .sort((a, b) => b.t.impressions - a.t.impressions);
}
