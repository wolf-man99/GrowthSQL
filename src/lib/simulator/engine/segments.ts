/**
 * Who saw it, and where: per-segment delivery.
 *
 * Ads Manager breakdowns are not a report written after the fact. They are the
 * same delivery, sliced by attributes every impression already carried, which is
 * why a placement row can show a CPM the ad set never averaged and a 45–54 row can
 * convert at twice the ad set's rate. This module makes that true here too: an age
 * band, a gender and a placement each carry their own price, click-through and
 * conversion rate, and the ad set's numbers are what falls out of the mix.
 *
 * The mechanism, and why it is only twelve numbers rather than fifty:
 *
 * An impression's three attributes are modelled as independent, and each one's
 * effect is a multiplier. Under those two assumptions the joint distribution
 * factorises, and the marginal share of a segment inside its own dimension no
 * longer depends on the other two — the cross terms cancel. So computing the five
 * age bands, two genders and five placements separately gives exactly the same
 * answer as materialising all fifty combinations, for a twentieth of the work.
 * The independence assumption is the modelling claim being made here; everything
 * downstream of it is arithmetic.
 *
 * Totals are expressed relative to a *reference mix* — an unrestricted 18–65
 * audience at middling warmth on Advantage+ placements — because that is the blend
 * `MODEL.baseCpm`, `baseCtr*` and `baseCvr*` were calibrated against. An ad set on
 * exactly that mix delivers exactly the blended rates. One that deviates does not,
 * and that is the point: narrowing to 45–54 really does cost more per thousand and
 * really does convert better, and dropping Audience Network really does raise your
 * CPM while improving what the traffic is worth.
 */

import type { SimAudience } from './types';

export const AGE_BANDS = ['18–24', '25–34', '35–44', '45–54', '55+'] as const;
export const GENDER_BANDS = ['Men', 'Women'] as const;
export const PLACEMENTS = [
  'Facebook Feed', 'Instagram Feed', 'Instagram Reels', 'Stories', 'Audience Network',
] as const;

export type SegmentDimension = 'age' | 'gender' | 'placement';

export const SEGMENT_DIMENSIONS: SegmentDimension[] = ['age', 'gender', 'placement'];

export const SEGMENT_KEYS: Record<SegmentDimension, readonly string[]> = {
  age: AGE_BANDS,
  gender: GENDER_BANDS,
  placement: PLACEMENTS,
};

/** What one segment does to price and response, relative to the blended rate. */
interface SegmentFactors {
  cpm: number;
  ctr: number;
  cvr: number;
}

/**
 * Age. The pattern every D2C buyer eventually finds for themselves: the young are
 * cheap to reach and click enthusiastically without buying, and the middle-aged
 * cost a fortune per thousand and are worth it. A learner who reads only CPM
 * concludes the opposite of the truth, which is precisely why the breakdown has to
 * carry conversion rate alongside it.
 */
const AGE_FACTORS: Record<string, SegmentFactors> = {
  '18–24': { cpm: 0.82, ctr: 1.10, cvr: 0.72 },
  '25–34': { cpm: 0.95, ctr: 1.05, cvr: 1.05 },
  '35–44': { cpm: 1.15, ctr: 0.92, cvr: 1.20 },
  '45–54': { cpm: 1.30, ctr: 0.85, cvr: 1.25 },
  '55+':   { cpm: 1.40, ctr: 0.78, cvr: 1.10 },
};

/** Mild, and specific to this brand's category rather than a general claim. */
const GENDER_FACTORS: Record<string, SegmentFactors> = {
  Men:   { cpm: 0.98, ctr: 1.00, cvr: 0.95 },
  Women: { cpm: 1.04, ctr: 1.00, cvr: 1.08 },
};

/**
 * Placement. Audience Network is the one that matters: cheap enough to look like a
 * bargain, a click-through rate inflated by mis-taps, and a conversion rate that
 * makes almost none of it real. An ad set on Advantage+ placements quietly routes a
 * chunk of its budget there, and the only way to see it is this breakdown.
 */
const PLACEMENT_FACTORS: Record<string, SegmentFactors> = {
  'Facebook Feed':   { cpm: 1.05, ctr: 1.05, cvr: 1.15 },
  'Instagram Feed':  { cpm: 1.10, ctr: 1.00, cvr: 1.10 },
  'Instagram Reels': { cpm: 0.72, ctr: 0.85, cvr: 0.70 },
  'Stories':         { cpm: 0.85, ctr: 0.80, cvr: 0.80 },
  // Roughly half of Feed's return once the cheap CPM is netted off against the
  // conversion rate. Not worthless — which is exactly why it survives on
  // Advantage+ by default and why buyers argue about it — but a real drag.
  'Audience Network': { cpm: 0.45, ctr: 1.30, cvr: 0.18 },
};

const FACTORS: Record<SegmentDimension, Record<string, SegmentFactors>> = {
  age: AGE_FACTORS,
  gender: GENDER_FACTORS,
  placement: PLACEMENT_FACTORS,
};

const AGE_RANGES: [number, number][] = [[18, 24], [25, 34], [35, 44], [45, 54], [55, 99]];
/** How the platform's attention is distributed, before any targeting narrows it. */
const AGE_POPULATION = [1.25, 1.4, 1.0, 0.7, 0.45];

/**
 * Which age bands the targeting lets through, and how heavily.
 *
 * A band the spec excludes gets zero and disappears from the breakdown entirely,
 * which is what makes narrowing an ad set's ages feel like it did something.
 */
function ageWeights(audience: SimAudience): number[] {
  const min = audience.spec?.ageMin ?? 18;
  const max = audience.spec?.ageMax ?? 65;
  return AGE_RANGES.map(([lo, hi], i) => (hi >= min && lo <= max ? AGE_POPULATION[i] : 0));
}

function genderWeights(audience: SimAudience): number[] {
  const g = audience.spec?.genders ?? 'all';
  if (g === 'men') return [1, 0];
  if (g === 'women') return [0, 1];
  return [0.94, 1.06];
}

/**
 * Where an ad set's impressions land.
 *
 * Cold prospecting skews to Reels, where the cheapest reach is; warm retargeting
 * concentrates in Feed, where people who already know the brand browse deliberately.
 * Manual placements drop Audience Network, because that is the first thing any buyer
 * turns off once they have looked at what it returns.
 */
function placementWeights(audience: SimAudience, advantagePlacements: boolean): number[] {
  const warm = clamp01(audience.warmth);
  return [
    0.9 + warm * 0.5,   // Facebook Feed
    1.0 + warm * 0.3,   // Instagram Feed
    1.5 - warm * 0.7,   // Instagram Reels
    0.8 - warm * 0.15,  // Stories
    advantagePlacements ? 0.45 - warm * 0.25 : 0, // Audience Network
  ].map((w, i) => (i === 4 && !advantagePlacements ? 0 : Math.max(0.05, w)));
}

/** Fractional shares of one metric across a dimension, plus the mix's own multiplier. */
export interface DimensionMix {
  dimension: SegmentDimension;
  keys: readonly string[];
  /** Share of the ad set's spend, impressions, clicks and purchases per segment. */
  spend: number[];
  impressions: number[];
  clicks: number[];
  purchases: number[];
}

export interface SegmentMix {
  /** Multipliers on the ad set's blended rates, from how its mix differs from the
   *  reference blend. Exactly 1 for an audience sitting on the reference mix. */
  cpmFactor: number;
  ctrFactor: number;
  cvrFactor: number;
  dimensions: DimensionMix[];
}

/** The blend the model's base rates describe: unrestricted, middling warmth,
 *  Advantage+ placements. Deviations from this are what move an ad set's numbers. */
const REFERENCE_AUDIENCE: SimAudience = {
  id: '__reference__', name: 'reference', type: 'saved', size: 4_000_000, warmth: 0.5,
};

function weightsFor(
  audience: SimAudience,
  advantagePlacements: boolean,
): Record<SegmentDimension, number[]> {
  return {
    age: ageWeights(audience),
    gender: genderWeights(audience),
    placement: placementWeights(audience, advantagePlacements),
  };
}

/**
 * One dimension's shares and the three scalars it contributes to the ad set total.
 *
 * Spend follows the raw delivery weight; impressions follow spend divided by that
 * segment's own price; clicks follow impressions times its own click-through;
 * purchases follow clicks times its own conversion rate. Each stage is normalised
 * to a share, so the four vectors always sum to one and the rows always reconcile
 * to the ad set above them.
 */
function mixForDimension(dimension: SegmentDimension, rawWeights: number[]) {
  const keys = SEGMENT_KEYS[dimension];
  const factors = FACTORS[dimension];
  const weightTotal = rawWeights.reduce((a, b) => a + b, 0);
  const spend = weightTotal > 0 ? rawWeights.map((w) => w / weightTotal) : rawWeights.map(() => 0);

  const impRaw = spend.map((s, i) => s / factors[keys[i]].cpm);
  const impTotal = impRaw.reduce((a, b) => a + b, 0);
  const impressions = impTotal > 0 ? impRaw.map((v) => v / impTotal) : impRaw;

  const clickRaw = impressions.map((s, i) => s * factors[keys[i]].ctr);
  const clickTotal = clickRaw.reduce((a, b) => a + b, 0);
  const clicks = clickTotal > 0 ? clickRaw.map((v) => v / clickTotal) : clickRaw;

  const purchRaw = clicks.map((s, i) => s * factors[keys[i]].cvr);
  const purchTotal = purchRaw.reduce((a, b) => a + b, 0);
  const purchases = purchTotal > 0 ? purchRaw.map((v) => v / purchTotal) : purchRaw;

  return {
    mix: { dimension, keys, spend, impressions, clicks, purchases } satisfies DimensionMix,
    // `impTotal` is impressions bought per rupee relative to the blended price, so a
    // mix leaning on cheap inventory raises it and lowers the effective CPM.
    cpm: impTotal > 0 ? 1 / impTotal : 1,
    ctr: clickTotal,
    cvr: purchTotal,
  };
}

/** Cached because the mix depends only on targeting, and targeting rarely changes. */
const mixCache = new Map<string, SegmentMix>();

function referenceScalars() {
  const w = weightsFor(REFERENCE_AUDIENCE, true);
  let cpm = 1, ctr = 1, cvr = 1;
  for (const d of SEGMENT_DIMENSIONS) {
    const m = mixForDimension(d, w[d]);
    cpm *= m.cpm; ctr *= m.ctr; cvr *= m.cvr;
  }
  return { cpm, ctr, cvr };
}
const REFERENCE = referenceScalars();

export function segmentMixFor(audience: SimAudience, advantagePlacements: boolean): SegmentMix {
  const spec = audience.spec;
  const key = [
    audience.id, advantagePlacements ? 'adv' : 'man', audience.warmth.toFixed(3),
    spec ? `${spec.ageMin}-${spec.ageMax}-${spec.genders}` : 'open',
  ].join('|');
  const hit = mixCache.get(key);
  if (hit) return hit;

  const weights = weightsFor(audience, advantagePlacements);
  const dimensions: DimensionMix[] = [];
  let cpm = 1, ctr = 1, cvr = 1;
  for (const d of SEGMENT_DIMENSIONS) {
    const m = mixForDimension(d, weights[d]);
    dimensions.push(m.mix);
    cpm *= m.cpm; ctr *= m.ctr; cvr *= m.cvr;
  }

  const mix: SegmentMix = {
    cpmFactor: cpm / REFERENCE.cpm,
    ctrFactor: ctr / REFERENCE.ctr,
    cvrFactor: cvr / REFERENCE.cvr,
    dimensions,
  };
  mixCache.set(key, mix);
  return mix;
}

// ───────────────────────────────────────────────────────────── apportioning ──

/** One segment's slice of a day, in the same units as everything else. */
export interface SegmentDayResult {
  dimension: SegmentDimension;
  segment: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  purchases: number;
  revenue: number;
}

/**
 * Splits a whole number across shares without losing any of it.
 *
 * Largest remainder, so the parts always add back to the total. A breakdown whose
 * rows do not sum to the row above them is worse than no breakdown at all: it
 * teaches a learner to distrust numbers that were right.
 */
function allocate(total: number, shares: number[]): number[] {
  if (total <= 0) return shares.map(() => 0);
  const raw = shares.map((s) => s * total);
  const out = raw.map(Math.floor);
  let remainder = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) out[order[k].i]++;
  return out;
}

/**
 * The day's totals, broken out along all three dimensions.
 *
 * Each dimension partitions the *same* delivery, so all three sum back to the
 * identical ad set total — which is exactly the property real breakdowns have and
 * the reason they can be trusted to diagnose with.
 */
export function segmentsFor(
  mix: SegmentMix,
  totals: { spend: number; impressions: number; linkClicks: number; purchases: number; revenue: number },
): SegmentDayResult[] {
  const out: SegmentDayResult[] = [];
  for (const d of mix.dimensions) {
    const spend = allocate(totals.spend, d.spend);
    const impressions = allocate(totals.impressions, d.impressions);
    const linkClicks = allocate(totals.linkClicks, d.clicks);
    const purchases = allocate(totals.purchases, d.purchases);
    const revenue = allocate(totals.revenue, d.purchases);
    d.keys.forEach((segment, i) => {
      if (d.spend[i] <= 0) return; // targeting excluded it; no row rather than a zero
      out.push({
        dimension: d.dimension, segment,
        spend: spend[i], impressions: impressions[i], linkClicks: linkClicks[i],
        purchases: purchases[i], revenue: revenue[i],
      });
    });
  }
  return out;
}

/** Merges segment rows from several ads or ad sets into one set of rows. */
export function mergeSegments(groups: SegmentDayResult[][]): SegmentDayResult[] {
  const map = new Map<string, SegmentDayResult>();
  for (const group of groups) {
    for (const r of group) {
      const key = `${r.dimension}|${r.segment}`;
      const cur = map.get(key);
      if (!cur) { map.set(key, { ...r }); continue; }
      cur.spend += r.spend; cur.impressions += r.impressions; cur.linkClicks += r.linkClicks;
      cur.purchases += r.purchases; cur.revenue += r.revenue;
    }
  }
  return Array.from(map.values());
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
