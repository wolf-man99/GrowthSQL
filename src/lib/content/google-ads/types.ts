import type { CourseLesson, CourseModule, LessonCard } from '../lesson-cards';

/**
 * Google Ads' slice of the shared card model.
 *
 * The diagram list is deliberately not a translation of Meta's. The two platforms
 * are not the same shape: Meta's core object is an audience and Google's is a
 * query, so where Meta needs a picture of a lookalike, Google needs one of a
 * keyword matching a search term it never contained. Reusing Meta's vocabulary
 * here would have quietly taught learners that the platforms work the same way,
 * which is the single most expensive misconception a Meta buyer brings to Search.
 */

export type GDiagramVariant =
  /** Account > Campaign > Ad group > Keywords + Ads, and what lives where. */
  | 'account-structure'
  /** Demand capture vs demand creation, side by side. */
  | 'intent-vs-interruption'
  /** Bid x Quality Score, and why the highest bid does not always win. */
  | 'ad-rank'
  /** Broad, phrase and exact drawn as nested reach, with the overlap that bites. */
  | 'match-types'
  /** A keyword, the search terms it actually matched, and the negatives that stop it. */
  | 'search-terms'
  /** The three Quality Score components and what each one is really measuring. */
  | 'quality-score'
  /** Headlines, descriptions, path, assets: the parts of a responsive search ad. */
  | 'rsa-anatomy'
  /** Manual through to tROAS, ordered by how much control you hand over. */
  | 'bidding-ladder'
  /** Merchant Center to Shopping ad: where a product feed actually goes. */
  | 'shopping-flow'
  /** Asset groups, signals, and the channels Performance Max spans. */
  | 'pmax-structure'
  /** Impression share, lost to rank, lost to budget: one bar, three parts. */
  | 'impression-share'
  /** The optimisation loop: mine terms, negate, refine, expand. */
  | 'optimisation-loop';

export type GCalcVariant =
  /** Ad Rank from bid and Quality Score, and the actual CPC that falls out. */
  | 'ad-rank'
  /** The CPC a margin can bear at a given conversion rate. */
  | 'breakeven-cpc'
  /** Target CPA and target ROAS from the same unit economics. */
  | 'target-cpa'
  /** What a click is worth once conversion rate and order value are known. */
  | 'click-value'
  /** Budget against impression share lost to budget. */
  | 'budget-headroom';

export type GoogleCard = LessonCard<GDiagramVariant, GCalcVariant>;
export type GoogleLesson = CourseLesson<GDiagramVariant, GCalcVariant>;
export type GoogleModule = CourseModule<GDiagramVariant, GCalcVariant>;

export { isInteractive, p, h, list, key } from '../lesson-cards';
