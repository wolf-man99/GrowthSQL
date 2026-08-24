/**
 * Meta Ads Mastery pricing. One course, three purchasable products, a shape the
 * single `Course.price` field in the registry can't hold, so it lives here instead.
 * The server is always the source of truth for amount: routes look prices up from
 * this table by `product`, never trust a client-supplied number.
 */

export type Product = 'learn' | 'run' | 'bundle';

/** Rupees, not paise, convert at the Razorpay API boundary (see toPaise). */
export const META_ADS_PRICING: Record<Product, number> = {
  learn: 499,
  run: 999,
  bundle: 1199,
};

/** Modules 1..FREE_MODULE_COUNT are playable without paying; the rest need `learn`
 *  or `bundle`. Matches MetaModule.index (1-based), from src/lib/content/meta-ads. */
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
 */
export function isProductPurchasable(product: Product, hasLearn: boolean, hasRun: boolean): boolean {
  if (product === 'learn') return !hasLearn;
  if (product === 'run') return hasLearn && !hasRun;
  return !hasLearn; // bundle
}
