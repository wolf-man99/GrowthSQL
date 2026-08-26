/**
 * Missions: the graded scenarios that turn the Google Ads simulator into a course.
 *
 * A sandbox teaches by letting somebody poke at an account. A mission teaches by
 * putting them in a specific situation with a specific goal and then telling them,
 * honestly, whether they reached it and why. There is one per Learn module, so
 * everything the theory claims gets practised where it applies.
 *
 * Three rules run through all of them, and the gate enforces the first two:
 *
 *   1. **The wrong instinct has to fail.** A learner who applies the wrong lesson
 *      should not scrape a pass. The most valuable checks in the calibration gate
 *      are the ones asserting that a plausible mistake — raise the budget, negate
 *      the competitor terms, chase the cheapest cost per install — makes things
 *      worse rather than better.
 *   2. **Objectives are measured, never judged.** "Cut spend on non-converting
 *      search terms below 15%" is a number the engine records. "Structure the
 *      account well" is not, and would make the grade feel arbitrary.
 *   3. **The debrief explains the mechanism, not the verdict.** Passing without
 *      understanding is a worse outcome than failing and being told why.
 */

import type { GState } from '../engine/types';

/**
 * Metrics an objective can be measured against, all derived from recorded days.
 *
 * Search-specific ones outnumber the general ones deliberately. Cost and ROAS are
 * available on any platform; impression share, Quality Score and the brand split
 * are the numbers that make a *Google* account diagnosable, and a mission set
 * graded only on ROAS would be teaching Meta with different words.
 *
 * Two obvious candidates are deliberately absent. "Share of spend on search terms
 * that never converted" and "the most expensive non-converting term" both sound
 * like the right way to grade a negatives pass, and neither behaves: on a
 * budget-limited account, money you stop spending on one bad search lands on the
 * next one, so the aggregate barely moves and the worst single term can get *worse*
 * as the account gets better. What a negatives pass reliably improves is cost per
 * conversion, so that is what the missions measure.
 */
export type GMetricKey =
  | 'roas'
  | 'cpa'
  | 'cost'
  | 'conversions'
  | 'ctr'
  | 'cpc'
  /** Share of eligible auctions lost because a campaign was out of money, 0..1. */
  | 'lostToBudgetShare'
  /** Share of eligible auctions lost on Ad Rank, 0..1. */
  | 'lostToRankShare'
  /** Impression-weighted Quality Score across every active keyword, 1..10. */
  | 'avgQualityScore'
  /** Impressions the Search campaigns won on brand queries, as a share of the
   *  brand auctions they were eligible for. The measurement that makes
   *  Performance Max cannibalisation visible. */
  | 'brandImpressionShare'
  /** Negative keywords in force. A blunt count, used only to require that a
   *  learner did the thing rather than got lucky. */
  | 'negativeCount'
  /**
   * Conversions from searches that did not name the brand.
   *
   * The objective that stops every mission being won by pausing everything except
   * the brand keyword. Brand is the best inventory in any account — it converts
   * several times better and costs a fraction as much — so on pure rate metrics
   * retreating to it beats every honest strategy, and would beat them in a real
   * account too. What stops a real business doing it is that brand is finite: it
   * is demand somebody else created, and there is only so much of it. Requiring
   * non-brand conversions is how that constraint gets said in a number.
   */
  | 'nonBrandConversions'
  /** App campaigns: share of installs performing the in-app action, 0..1. */
  | 'appActivation'
  /** App campaigns: cost per in-app action, in rupees. */
  | 'appCostPerEvent';

export type GComparator = 'gte' | 'lte';

export interface GObjective {
  id: string;
  /** Shown to the learner, in the curriculum's own language. */
  label: string;
  metric: GMetricKey;
  op: GComparator;
  value: number;
  /**
   * Where the measurement sits. `end` reads the final window; `everyDay` requires
   * the condition to hold throughout, which is how "without letting return on ad
   * spend fall below break-even" gets said.
   */
  when: 'end' | 'everyDay';
  /**
   * How many days one measurement covers.
   *
   * On an `everyDay` objective this is the difference between a rule about the
   * account and a rule about luck. Daily return on a real account swings on noise
   * alone, so a single-day floor fails whoever draws the worst Tuesday rather than
   * whoever bid worst. A multi-day window keeps the objective measuring what its
   * label says: a sustained slide, not one bad day.
   */
  window?: number;
  /** A word on why this number and not another, shown beside the objective. */
  why?: string;
}

export interface GMission {
  id: string;
  /** The Learn module this practises, so the interface can link back to it. */
  moduleSlug: string;
  order: number;
  title: string;
  /** One line: the situation. */
  situation: string;
  /** What they are being asked to do about it. */
  brief: string;
  /** Concrete nudges toward the right diagnosis, without giving the answer. */
  hints: string[];
  durationDays: number;
  xp: number;
  buildState: () => GState;
  objectives: GObjective[];
  /**
   * Written before anybody plays it: what the mission is actually teaching, shown
   * in the debrief whether they passed or failed. A learner who scraped a pass by
   * luck still needs to read it.
   */
  debrief: string;
}

export interface GObjectiveResult {
  id: string;
  label: string;
  passed: boolean;
  /** The measured value, for "you reached 2.1x, needed 2.5x". */
  actual: number;
  target: number;
  op: GComparator;
  metric: GMetricKey;
  why?: string;
}

export interface GMissionGrade {
  passed: boolean;
  /** Objectives met, out of the total. */
  met: number;
  total: number;
  /** 0..100, for the XP award and the progress ring. */
  score: number;
  objectives: GObjectiveResult[];
}
