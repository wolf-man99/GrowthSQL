/**
 * The auction: Ad Rank, Quality Score, and what you actually pay.
 *
 * Runs once per search, which is the point. Meta's auction prices an audience;
 * this one prices a question somebody asked, and the price depends as much on how
 * well you answer it as on what you bid. Every claim the Quality Score module
 * makes — that a lower bid can beat a higher one, that quality divides your cost,
 * that an ad can fail to show with no competitors at all — has to be a consequence
 * of the arithmetic here rather than something a lesson asserts.
 */

import {
  GMODEL,
  type Grade, type GAd, type GAdGroup, type GKeyword, type SearchQuery,
} from './types';
import { conceptsOf } from './matching';
import { jitter, type Rng } from './rng';

// ──────────────────────────────────────────────────────────── Quality Score ──

export interface QualityInputs {
  keyword: GKeyword;
  adGroup: GAdGroup;
  ads: GAd[];
  query: SearchQuery;
  /** How relevant the matched query actually is to the keyword, from matching.ts.
   *  A broad keyword dragged to the edge of its reach scores badly here, which is
   *  how loose matching quietly raises the price of everything. */
  matchRelevance: number;
}

export interface Quality {
  /** 1..10, as the interface reports it. */
  score: number;
  /** The multiplier the auction actually uses. Reported score is this, banded. */
  factor: number;
  detail: { expectedCtr: Grade; adRelevance: Grade; landingPage: Grade };
}

/**
 * How well the ad text answers the keyword.
 *
 * Measured as the share of the keyword's own concepts that appear in the ad's
 * headlines — which is exactly what Google is judging, and why "put the keyword in
 * the ad" is the oldest advice in search. An ad group holding four unrelated
 * themes cannot score well here no matter how good the copy is, because one ad
 * physically cannot contain four sets of keywords.
 */
export function adRelevance(keyword: GKeyword, ads: GAd[]): number {
  const live = ads.filter((a) => a.status === 'active');
  if (live.length === 0) return 0;
  const kc = conceptsOf(keyword.text);
  if (kc.length === 0) return 0.5;

  let best = 0;
  for (const ad of live) {
    const text = conceptsOf([...ad.headlines, ...ad.descriptions].join(' '));
    const present = new Set(text);
    const hits = kc.filter((c) => present.has(c)).length;
    best = Math.max(best, hits / kc.length);
  }
  // Floored, because Google's worst grade is "below average" and not "disqualified".
  // An ad that answers none of its keyword still runs — expensively, at the bottom
  // of the page — which is the state most sprawling ad groups are actually in.
  return GMODEL.adRelevanceFloor + (1 - GMODEL.adRelevanceFloor) * best;
}

/**
 * Expected click-through, blended between a prior and the keyword's own history.
 *
 * A brand-new keyword is judged on its ad group's shape until it has earned the
 * right to be judged on itself.
 *
 * The history it is judged on is **position-normalised**, which is not a detail.
 * Google states plainly that expected CTR is measured independently of where the
 * ad appeared, and the reason is that the alternative is circular: an ad in
 * position five earns few clicks *because* it is in position five, and scoring it
 * down for that would drive it lower still. A keyword would then be unable to
 * recover from one bad day, and every Quality Score lesson in the course would be
 * a lie. `ctrEma` is therefore stored already divided by the position decay it was
 * earned at — what the ad would have achieved at the top of the page.
 */
export function expectedCtr(keyword: GKeyword, relevance: number): number {
  const prior = 0.42 + relevance * 0.5;
  const samples = keyword.runtime.ctrSamples;
  if (samples <= 0) return prior;
  const weight = Math.min(1, samples / GMODEL.ctrPriorSamples);
  // Normalised against a strong top-of-page search CTR, so that figure reads as
  // "average" and the scale around it stays comparable to the prior.
  const own = Math.min(1.7, keyword.runtime.ctrEma / (GMODEL.ctrAtTop / 100));
  return prior * (1 - weight) + own * weight;
}

function grade(value: number, low: number, high: number): Grade {
  return value < low ? 'below' : value > high ? 'above' : 'average';
}

export function computeQuality(i: QualityInputs): Quality {
  const relevance = adRelevance(i.keyword, i.ads) * (0.55 + i.matchRelevance * 0.45);
  const ctr = expectedCtr(i.keyword, relevance);
  const page = i.adGroup.landingPageQuality;

  // Brand searches score near-perfectly on your own name: your ad is the answer,
  // your page is the answer, and everybody clicks it.
  const brandLift = i.query.brand ? GMODEL.brandQualityBonus : 1;

  const raw =
    ctr * GMODEL.qsWeightExpectedCtr
    + relevance * GMODEL.qsWeightAdRelevance
    + page * GMODEL.qsWeightLandingPage;

  const factor = Math.max(0.25, Math.min(2.2, raw * brandLift));
  // Reported 1..10. A factor of 1 is a middling 6, which matches how accounts
  // actually read: seven is fine, four is a problem, ten is rare.
  const score = Math.max(1, Math.min(10, Math.round(factor * 5.8)));

  return {
    score,
    factor,
    detail: {
      expectedCtr: grade(ctr, 0.62, 1.05),
      adRelevance: grade(relevance, 0.45, 0.8),
      landingPage: grade(page, 0.8, 1.05),
    },
  };
}

// ─────────────────────────────────────────────────────────────────── bidding ──

/**
 * The chance a click on this query converts.
 *
 * One definition, used by the bidder and by delivery alike. Two of them would
 * eventually disagree, and the account would then be bidding against a conversion
 * rate it does not actually get — which is a real failure mode of real bidding
 * systems, but not one worth introducing by accident.
 *
 * `relevance` is how well the keyword that won the auction actually matches the
 * search. A query dragged in at the edge of broad match converts far below the
 * keyword's core, and that gap is why the search terms report is worth reading.
 */
export function conversionRate(query: SearchQuery, siteQuality: number, relevance = 1): number {
  return (GMODEL.intentCvr[query.intent] / 100)
    * query.cvrMultiplier
    * siteQuality
    * (query.brand ? GMODEL.brandCvrMultiplier : 1)
    * (GMODEL.relevanceCvrFloor + relevance * (1 - GMODEL.relevanceCvrFloor));
}

/** What one click on this query is worth to this account, before any strategy. */
export function clickValue(
  query: SearchQuery,
  conversionValue: number,
  siteQuality: number,
  relevance = 1,
): number {
  return conversionRate(query, siteQuality, relevance) * conversionValue;
}

/** The market's own price for this query, before anyone's quality is considered. */
export function marketCpc(query: SearchQuery, marketPressure: number, rng: Rng): number {
  return GMODEL.baseCpc
    * GMODEL.intentCpc[query.intent]
    * (0.55 + query.competition * 0.62)
    * marketPressure
    * jitter(rng, 0.18);
}

// ──────────────────────────────────────────────────────────────── the auction ──

export interface AuctionOutcome {
  /** Did the ad show at all? */
  shown: boolean;
  /** 1-based; 1 is the top of the page. Only meaningful when shown. */
  position: number;
  /** What this click would cost. Second price: enough to hold position against
   *  the ad below, divided by your own quality. */
  cpc: number;
  /** Why it did not show, when it did not. */
  lostTo: 'rank' | 'none';
}

/**
 * Ad Rank. The one equation the whole platform runs on, and the reason a lower bid
 * can beat a higher one.
 *
 * Deliberately just the two terms. The weekday shape belongs to how many people
 * search, not to how competitive you are on a Sunday — folding it in here would
 * quietly make the account worse at weekends for no reason anybody could name,
 * and would corrupt every weekday comparison downstream.
 */
export function adRank(bid: number, quality: Quality): number {
  return bid * quality.factor;
}

/**
 * The competitors in one search, as a sorted list of Ad Ranks.
 *
 * Drawn once per search and shared by every entrant, which matters more than it
 * looks: it means two of the learner's own campaigns face *the same* rivals, so
 * when one wins and the other does not, the difference is genuinely their own
 * Ad Rank and not two unrelated dice rolls. Every A/B comparison the calibration
 * gate makes depends on that.
 *
 * Rivals are drawn rather than modelled as persistent advertisers. They exist to
 * set a price; giving them identities would add state without adding a lesson.
 */
export function drawRivals(query: SearchQuery, marketPressure: number, rng: Rng): number[] {
  const base = marketCpc(query, marketPressure, rng);
  const count = Math.max(1, Math.round(GMODEL.competitorsBase * query.competition * jitter(rng, 0.3)));

  const ranks: number[] = [];
  for (let n = 0; n < count; n++) {
    // A bid around the market price, times a quality draw. Some rivals are
    // sharper than you and some are not.
    //
    // The centre matters and is easy to get wrong. `marketCpc` is what a click on
    // this query *costs*, and in a second-price auction the cost is set by the
    // rank below you — so rival ranks have to centre near the market price, not
    // above it. Centre them high and a perfectly sane bid never reaches the top of
    // the page, which would make the account unfixable by the very moves the
    // course teaches.
    ranks.push(base * (0.55 + rng() * 0.95) * (0.7 + rng() * 0.75));
  }
  return ranks.sort((a, b) => b - a);
}

export interface ResolveInputs {
  /** Your maximum bid for this auction, in rupees. */
  bid: number;
  quality: Quality;
  /** Your Ad Rank, from `adRank`. Passed in because the caller needs it anyway to
   *  decide which of its own campaigns is allowed to enter. */
  myRank: number;
  /** Rival Ad Ranks, descending, from `drawRivals`. */
  rivalRanks: number[];
  /** The search itself, which decides how much of the page is for sale. */
  query: SearchQuery;
}

/** Where you land against a given set of rivals, and what it costs. */
export function resolveAuction(i: ResolveInputs): AuctionOutcome {
  const { bid, quality, myRank, rivalRanks } = i;

  // Below the absolute floor, nothing shows — no matter the bid, and with no
  // competitors required. This is what "rarely shown due to low Quality Score"
  // actually means, and it is why bidding your way out of a quality problem stops
  // working at some point.
  if (myRank < GMODEL.adRankFloor) {
    return { shown: false, position: 0, cpc: 0, lostTo: 'rank' };
  }

  const beaten = rivalRanks.filter((r) => r < myRank).length;
  const position = rivalRanks.length - beaten + 1;

  // Past the last slot this page sells, there is nowhere left to serve.
  if (position > GMODEL.slotsByIntent[i.query.intent]) {
    return { shown: false, position, cpc: 0, lostTo: 'rank' };
  }

  // Second price: pay just enough to hold position against the rank below you,
  // divided by your own Quality Score. This is the line that makes quality worth
  // money — it is the divisor, so doubling it halves the click.
  const below = rivalRanks[rivalRanks.length - beaten] ?? GMODEL.adRankFloor;
  const cpc = Math.min(bid, below / quality.factor + 0.01);

  return { shown: true, position, cpc: Math.max(1, cpc), lostTo: 'none' };
}

export interface AuctionInputs {
  query: SearchQuery;
  bid: number;
  quality: Quality;
  marketPressure: number;
  rng: Rng;
}

/** Draw and resolve in one call. Convenient for a single-advertiser check; the
 *  tick uses the two halves separately so entrants can share one set of rivals. */
export function runAuction(i: AuctionInputs): AuctionOutcome {
  return resolveAuction({
    bid: i.bid,
    quality: i.quality,
    myRank: adRank(i.bid, i.quality),
    rivalRanks: drawRivals(i.query, i.marketPressure, i.rng),
    query: i.query,
  });
}

/** Click-through by position. Steep, because it is steep in reality: the top slot
 *  takes a multiple of what the fourth does, which is most of why Ad Rank matters. */
export function ctrForPosition(position: number, quality: Quality, query: SearchQuery): number {
  const decay = GMODEL.ctrPositionDecay ** (position - 1);
  const base = GMODEL.ctrAtTop * decay;
  // A more relevant ad earns more clicks from the same slot.
  const relevanceLift = 0.62 + quality.factor * 0.42;
  const brand = query.brand ? 2.1 : 1;
  return Math.max(0.05, base * relevanceLift * brand);
}
