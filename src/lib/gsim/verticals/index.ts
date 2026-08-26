/**
 * The businesses a learner can run an account for.
 *
 * Two verticals, chosen because the arithmetic of paid search changes completely
 * between them and almost nothing else does. NORTHBOUND sells a ₹4,200 pair of
 * shoes to somebody who decides in an afternoon; Ledgerline sells a ₹90,000 annual
 * contract to a committee, and counts a booked demo as the conversion.
 *
 * The same engine runs both. What differs is the value of a conversion, how many
 * clicks it takes, and therefore what a sane CPC even is — which is exactly the
 * thing that transfers when a learner changes jobs, and exactly the thing a
 * single-vertical course cannot teach.
 */

import type { GAccountConditions, SearchQuery } from '../engine/types';
import { D2C_QUERIES } from './d2c';
import { B2B_QUERIES } from './b2b';

export type VerticalId = 'd2c' | 'b2b';

export interface Vertical {
  id: VerticalId;
  /** The fictional company. */
  brand: string;
  label: string;
  /** One line a learner reads before choosing. */
  premise: string;
  /** What they are actually buying, in the learner's own words. */
  product: string;
  conditions: GAccountConditions;
  queries: SearchQuery[];
  /** A rough sanity figure for scenario authoring: total searches per day. */
  dailySearches: number;
  /** Break-even ROAS, or break-even CPA for a lead business. Displayed, because a
   *  buyer who does not know their own break-even is guessing. */
  breakEven: { kind: 'roas'; value: number } | { kind: 'cpa'; value: number };
}

export const VERTICALS: Record<VerticalId, Vertical> = {
  d2c: {
    id: 'd2c',
    brand: 'NORTHBOUND',
    label: 'D2C — running shoes',
    premise:
      'A direct-to-consumer running shoe brand. One decision, made in an afternoon, '
      + 'measured in orders.',
    product: '₹4,200 average order, 46% gross margin.',
    conditions: {
      conversionValue: 4200,
      margin: 0.46,
      siteQuality: 1,
      marketPressure: 1,
      conversionName: 'Purchase',
    },
    queries: D2C_QUERIES,
    dailySearches: D2C_QUERIES.reduce((n, q) => n + q.volume, 0),
    // Spend can be at most the margin on the revenue it produces.
    breakEven: { kind: 'roas', value: 1 / 0.46 },
  },

  b2b: {
    id: 'b2b',
    brand: 'Ledgerline',
    label: 'B2B SaaS — accounting software',
    premise:
      'Accounting software sold to finance teams. The conversion is a booked demo, '
      + 'not a sale, and most of them never become one.',
    product:
      '₹90,000 annual contract. 22% of demos close, so a demo is worth about ₹19,800 '
      + 'in pipeline value.',
    conditions: {
      // A booked demo, valued at contract × close rate. Modelling the demo rather
      // than the deal is what makes lead-gen genuinely different: the platform can
      // only optimise toward what you send it, and a demo is not money.
      conversionValue: 19_800,
      margin: 0.78,
      siteQuality: 1,
      // B2B search clicks cost several times what consumer ones do. Nothing about
      // the auction changes — the market is simply richer, because a click that
      // might start a ₹90,000 contract is worth more to everybody bidding on it.
      marketPressure: 3.4,
      conversionName: 'Demo booked',
    },
    queries: B2B_QUERIES,
    dailySearches: B2B_QUERIES.reduce((n, q) => n + q.volume, 0),
    // At 78% margin on ₹19,800 of pipeline value, a demo may cost up to ~₹15,400.
    breakEven: { kind: 'cpa', value: 19_800 * 0.78 },
  },
};

export const VERTICAL_LIST: Vertical[] = [VERTICALS.d2c, VERTICALS.b2b];

export { D2C_QUERIES } from './d2c';
export { B2B_QUERIES } from './b2b';
