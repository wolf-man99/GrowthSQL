/**
 * What each course costs, and which products it actually sells.
 *
 * The registry's single `Course.price` field cannot hold this: each course sells
 * three products (Learn, Run, and the bundle of both) at three prices. The server
 * is always the source of truth for amount — routes look prices up here by course
 * and product, and never trust a number that arrived from a browser.
 *
 * `sells` is the important half. A course with no Run tier must not be able to
 * take money for one, and the check has to live somewhere the checkout route reads
 * rather than somewhere the UI happens not to render.
 */

export type Product = 'learn' | 'run' | 'bundle';

export interface CoursePricing {
  /** Rupees, not paise. Converted at the Razorpay boundary; see toPaise. */
  prices: Partial<Record<Product, number>>;
  /** Which products this course actually offers for sale. */
  sells: Product[];
}

export const COURSE_PRICING: Record<string, CoursePricing> = {
  'meta-ads': {
    prices: { learn: 499, run: 999, bundle: 1199 },
    sells: ['learn', 'run', 'bundle'],
  },
  // Priced above Meta on purpose: Search is the harder discipline, the accounts it
  // runs are usually larger, and the buyer is further along.
  //
  // The bundle saves ₹499 against buying both, which is deliberately a smaller
  // discount than Meta's: there is less reason to nudge somebody into a Run tier
  // they may not be ready for when Learn alone is a fuller course here.
  'google-ads': {
    prices: { learn: 999, run: 1999, bundle: 2499 },
    sells: ['learn', 'run', 'bundle'],
  },
};

/** Back-compat alias for the Meta course's table, which several views read directly. */
export const META_ADS_PRICING = {
  learn: COURSE_PRICING['meta-ads'].prices.learn!,
  run: COURSE_PRICING['meta-ads'].prices.run!,
  bundle: COURSE_PRICING['meta-ads'].prices.bundle!,
} as const;

export function pricingFor(courseId: string): CoursePricing | undefined {
  return COURSE_PRICING[courseId];
}

/** The price of one product on one course, or undefined if it is not sold there. */
export function priceOf(courseId: string, product: Product): number | undefined {
  const pricing = COURSE_PRICING[courseId];
  if (!pricing || !pricing.sells.includes(product)) return undefined;
  return pricing.prices[product];
}

/** Whether a course sells anything at all, for views deciding to show a price. */
export function isCoursePaid(courseId: string): boolean {
  return (COURSE_PRICING[courseId]?.sells.length ?? 0) > 0;
}

/** Modules 1..FREE_MODULE_COUNT are playable without paying; the rest need `learn`
 *  or `bundle`. Matches the 1-based `index` on every course's module list. */
export const FREE_MODULE_COUNT = 2;

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function isProduct(value: unknown): value is Product {
  return value === 'learn' || value === 'run' || value === 'bundle';
}

/**
 * Purchase eligibility, not content access. See gating.ts for what a purchase
 * unlocks. Run is never a first purchase, only an upgrade once Learn is already
 * owned (Learn is a hard prerequisite for Run's own progress gate anyway, so a
 * standalone Run purchase would just strand the buyer at the free preview). Bundle
 * is only useful before owning Learn. Buying it afterward would just re-pay for
 * Learn a second time. Every branch also blocks re-buying a product already owned,
 * a real charge that used to be possible via a stale tab or a direct API call.
 *
 * `courseId` gates on what the course actually sells, so a Learn-only course
 * cannot be talked into selling a Run tier it has not built.
 */
export function isProductPurchasable(
  product: Product,
  hasLearn: boolean,
  hasRun: boolean,
  courseId = 'meta-ads',
): boolean {
  if (!COURSE_PRICING[courseId]?.sells.includes(product)) return false;
  if (product === 'learn') return !hasLearn;
  if (product === 'run') return hasLearn && !hasRun;
  return !hasLearn; // bundle
}
