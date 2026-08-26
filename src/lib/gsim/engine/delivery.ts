/**
 * The tick: one simulated day of search.
 *
 * The shape is genuinely different from Meta's, and the difference is the course.
 * Meta's tick loops over ad sets and asks how much each can spend. This one loops
 * over **searches** and asks, for each one, which of your keywords was eligible,
 * what the auction charged, and what the searcher did next.
 *
 * Ordering, per search:
 *
 *   1. every query gets its day's volume, shaped by weekday and noise
 *   2. eligible keywords are found; negatives remove some outright
 *   3. the rivals for this one search are drawn **once** and shared, so when two of
 *      your own campaigns face the same auction they face the same opposition
 *   4. only one of your ads may serve — Google runs one ad per advertiser per
 *      auction — so your own campaigns are resolved against each other first
 *   5. the survivor runs the auction; wins and losses are recorded with a cause
 *   6. clicks and conversions follow position, quality and the query's own worth
 *
 * Step 4 is where Performance Max eats a Search campaign's brand traffic, and step
 * 6's budget check is why impression share is honest here: lost-to-budget is not
 * estimated from a ratio, it is a count of auctions the account was eligible for
 * and declined to enter because the campaign was already capped.
 */

import {
  GMODEL, G_WEEKDAY_WEIGHT, dayShareAt, drawSearchTime, emptyDayMetrics,
  type CampaignDayResult, type GAd, type GAdGroup, type GCampaign, type GDayMetrics,
  type GDayResult, type GKeyword, type GState, type KeywordDayResult, type KeywordState,
  type PmaxInsightRow, type SearchTermRow, type SearchQuery,
} from './types';
import { eligibleKeywords, negativeBlocks, negativesFor, winnerPerCampaign } from './matching';
import {
  adRank, clickValue, computeQuality, conversionRate, ctrForPosition, drawRivals,
  resolveAuction, type Quality,
} from './auction';
import { jitter, mulberry32, streamFor, stringSeed, type Rng } from './rng';

export interface GTickOptions {
  seed: number;
}

const isLive = (x: { status: string }) => x.status === 'active';

/** Today's searches for one query: volume shaped by weekday, then noise. */
function searchesToday(query: SearchQuery, weekdayIndex: number, rng: Rng): number {
  const shaped = query.volume * G_WEEKDAY_WEIGHT[weekdayIndex] * jitter(rng, GMODEL.dailyNoise);
  const whole = Math.floor(shaped);
  return whole + (rng() < shaped - whole ? 1 : 0);
}

/**
 * What this keyword bids in this auction.
 *
 * Manual CPC bids what you told it to. Smart Bidding bids what the click is worth,
 * scaled by the strategy's constraint — which is the whole idea: it is not bidding
 * a number, it is bidding a prediction, and the prediction is only as good as the
 * conversion data behind it.
 */
function bidFor(
  campaign: GCampaign,
  adGroup: GAdGroup,
  keyword: GKeyword,
  query: SearchQuery,
  conversionValue: number,
  siteQuality: number,
  matchRelevance: number,
  dataDays: number,
  /** What the average search in this market is worth. What a strategy with no data
   *  of its own falls back on, and therefore what it mistakes everything for. */
  meanWorth: number,
  /** Gross margin on a conversion. The ceiling on what a click can be worth paying. */
  margin: number,
  rng: Rng,
): number {
  const manual = keyword.maxCpc ?? adGroup.defaultCpc ?? 25;

  if (campaign.bidStrategy === 'manual_cpc') return manual;
  if (campaign.bidStrategy === 'maximise_clicks') {
    // Buys the cheapest traffic it can, indifferent to what it is worth.
    return manual * 0.72 * jitter(rng, 0.2);
  }

  // Everything below is a prediction of value, damped by how relevant the match
  // really is: a broad keyword dragged to the edge of its reach is bidding on a
  // query it does not understand, and Smart Bidding knows that.
  const trueWorth = clickValue(query, conversionValue, siteQuality, matchRelevance);

  // Starved of conversions, the prediction is not cautious — it is wrong, and
  // wrong in a specific, predictable direction. With nothing to distinguish one
  // search from another it falls back on the account average, which over-values
  // everything cheap and under-values everything good. This is the single most
  // important thing the bidding module teaches, so it has to bite here.
  const needed = STRATEGY_DATA_NEED[campaign.bidStrategy] ?? 0;
  const conversions = campaign.runtime.trailingConversions.reduce((a, b) => a + b, 0);
  const dataRatio = needed > 0 ? Math.min(1, conversions / needed) : 1;

  const shrink = (1 - dataRatio) * GMODEL.smartBiddingShrink;
  const error = predictionError(campaign.id, query.id, dataRatio);
  const worth = (trueWorth * (1 - shrink) + meanWorth * shrink) * error;

  const confidence = GMODEL.smartBiddingStarvedPenalty
    + (1 - GMODEL.smartBiddingStarvedPenalty) * dataRatio;

  // Re-learning after a strategy or target change.
  const learning = dataDays < GMODEL.strategyLearningDays ? GMODEL.strategyLearningPenalty : 1;

  // What it can afford: the gross margin on the revenue it expects, less a little.
  // Bidding the full revenue would be break-even at best, which no strategy does.
  let bid = worth * margin * GMODEL.smartBiddingAggression
    * confidence * learning * jitter(rng, 0.22);

  if (campaign.bidStrategy === 'target_cpa' && campaign.targetCpa) {
    // A target CPA is a ceiling on what a conversion may cost, so the bid it
    // permits is that target times the chance this click converts — the chance it
    // *believes* in, error and all. The cap cannot protect the account from the
    // model's own misjudgement, which is exactly why a cold target both overspends
    // on junk and abandons traffic that was working.
    const trueCvr = conversionRate(query, siteQuality, matchRelevance);
    const meanCvr = conversionValue > 0 ? meanWorth / conversionValue : trueCvr;
    const cvr = (trueCvr * (1 - shrink) + meanCvr * shrink) * error;
    bid = Math.min(bid, campaign.targetCpa * cvr);
  }
  if (campaign.bidStrategy === 'target_roas' && campaign.targetRoas) {
    // A target ROAS is the same constraint read the other way round: revenue over
    // spend, so the spend it permits is the revenue it predicts divided by the
    // ratio asked for. Predicted, error and all — which is why a cold target ROAS
    // both overspends on searches it has misjudged upward and abandons ones it has
    // misjudged down.
    bid = Math.min(bid, worth / campaign.targetRoas);
  }

  return Math.max(1, bid);
}

const STRATEGY_DATA_NEED: Partial<Record<GCampaign['bidStrategy'], number>> = {
  maximise_conversions: 15,
  target_cpa: 30,
  target_roas: 50,
};

/**
 * How wrong this campaign's value prediction is for this query, right now.
 *
 * Drawn from the campaign and query alone, so the misjudgement is *stable*: the
 * strategy is consistently wrong about a kind of search rather than randomly wrong
 * about each auction, which is both how it behaves and what makes the mistake
 * survive long enough to cost real money. Centred on 1 and symmetric in log space,
 * so over- and under-valuation are equally likely, and it closes to exactly 1 once
 * the strategy has the conversions it needs.
 */
function predictionError(campaignId: string, queryId: string, dataRatio: number): number {
  const spread = GMODEL.smartBiddingBlindSpread * (1 - dataRatio);
  if (spread <= 0) return 1;
  const draw = mulberry32(stringSeed(`${campaignId}|${queryId}`))();
  // Normalised so the error has mean 1. Without this the exponential of a
  // symmetric draw averages above 1 — sinh(s)/s — and a starved strategy would
  // quietly bid *more* than a trained one, turning "automation is guessing" into
  // "automation is aggressive". The lesson is misallocation, not inflation.
  return Math.exp((draw * 2 - 1) * spread) * (spread / Math.sinh(spread));
}

/**
 * Performance Max's eligibility, which is not a keyword at all.
 *
 * PMax has no keywords, so it enters auctions by appetite rather than by match: it
 * will bid on anything it predicts will convert, brand searches very much
 * included. `pmaxReach` sets how far past obvious commercial intent it goes, and
 * what it finds out there converts worse in proportion to the distance.
 */
function pmaxRelevance(query: SearchQuery, reach: number, rng: Rng): number | null {
  if (query.brand) {
    // The behaviour that surprises everyone: PMax happily takes your own brand
    // traffic, because it is the cheapest, best-converting inventory available.
    return rng() < GMODEL.pmaxBrandAppetite * reach ? 0.95 : null;
  }
  const commercial = query.intent === 'transactional' ? 0.9
    : query.intent === 'commercial' ? 0.7
      : 0.28;
  if (rng() > commercial * reach) return null;
  // Outside high intent, what it buys is worth less than it looks.
  const penalty = query.intent === 'informational' ? GMODEL.pmaxOutsideIntentPenalty : 1;
  return Math.max(0.15, commercial * penalty);
}

/** The bucket Performance Max reports a query under, since it will not report the
 *  query. Brand is split out because that is the one people need to find. */
function insightCategory(query: SearchQuery): string {
  if (query.brand) return 'Brand';
  return query.intent.charAt(0).toUpperCase() + query.intent.slice(1);
}

/** One of the account's own campaigns, ready to enter a single auction. */
interface Entrant {
  campaignId: string;
  campaign: GCampaign;
  /** Absent for Performance Max, which has no keywords. */
  keyword?: GKeyword;
  /** True when a Search campaign holds an exact-match keyword for this query,
   *  which is the one case that outranks Performance Max regardless of Ad Rank. */
  exact: boolean;
  relevance: number;
  quality: Quality;
  bid: number;
  rank: number;
}

export function tick(state: GState, opts: GTickOptions): { state: GState; result: GDayResult } {
  const next: GState = structuredClone(state);
  const day = next.day;
  const weekdayIndex = day % 7;

  const adGroupById = new Map(next.adGroups.map((g) => [g.id, g]));
  const campaignById = new Map(next.campaigns.map((c) => [c.id, c]));
  const keywordById = new Map(next.keywords.map((k) => [k.id, k]));

  const keywordOwner = (keywordId: string) => {
    const kw = keywordById.get(keywordId);
    if (!kw) return undefined;
    const group = adGroupById.get(kw.adGroupId);
    if (!group) return undefined;
    return { adGroupId: group.id, campaignId: group.campaignId };
  };

  const adsByGroup = new Map<string, GAd[]>();
  for (const ad of next.ads) {
    if (!isLive(ad)) continue;
    const list = adsByGroup.get(ad.adGroupId) ?? [];
    list.push(ad);
    adsByGroup.set(ad.adGroupId, list);
  }

  // ── Per-day accumulators ────────────────────────────────────────────────
  const spendByCampaign = new Map<string, number>();
  const cappedCampaigns = new Set<string>();
  const keywordDay = new Map<string, KeywordDayResult>();
  const searchTerms = new Map<string, SearchTermRow>();
  const pmaxDay = new Map<string, GDayMetrics>();
  const pmaxInsights = new Map<string, PmaxInsightRow>();
  const account = emptyDayMetrics();

  // Position and Quality Score are both averages over the day, so both have to be
  // accumulated rather than assigned. Quality is weighted by auctions entered,
  // because a keyword that matches one query ten thousand times and another twice
  // should report the score of the first.
  const positionTotals = new Map<string, { sum: number; n: number }>();
  const qualityTotals = new Map<string, {
    sum: number; n: number;
    /** The pairing this keyword spent most of its day in. Its component grades are
     *  what the interface shows, since one keyword reports one set of them. */
    top: Quality; topN: number; counts: Map<Quality, number>;
  }>();

  // Quality depends on the *pair*: the same broad keyword is excellent on its core
  // query and poor at the edge of its reach, and that difference is the entire
  // argument against loose matching. Caching it per keyword alone would silently
  // erase it.
  const qualityCache = new Map<string, Quality>();

  // The average value of a search in this market, weighted by how often it happens.
  // Only one thing uses it — a bid strategy with no data of its own — and that is
  // exactly the point: it is the number automation falls back on when it cannot yet
  // tell one search from another.
  let volumeSum = 0;
  let valueSum = 0;
  for (const q of next.queries) {
    volumeSum += q.volume;
    valueSum += q.volume * clickValue(q, next.conditions.conversionValue, next.conditions.siteQuality);
  }
  const meanWorth = volumeSum > 0 ? valueSum / volumeSum : 0;

  const liveSearchKeywords = next.keywords.filter((k) => {
    if (!isLive(k)) return false;
    const group = adGroupById.get(k.adGroupId);
    if (!group || !isLive(group)) return false;
    const campaign = campaignById.get(group.campaignId);
    if (!campaign || !isLive(campaign) || campaign.type !== 'search') return false;
    // A keyword with no live ad behind it cannot serve.
    return (adsByGroup.get(group.id)?.length ?? 0) > 0;
  });

  const livePmax = next.campaigns.filter((c) => isLive(c) && c.type === 'pmax');

  const ensureKeywordDay = (kw: GKeyword): KeywordDayResult => {
    let row = keywordDay.get(kw.id);
    if (!row) {
      const group = adGroupById.get(kw.adGroupId)!;
      row = {
        ...emptyDayMetrics(),
        keywordId: kw.id, adGroupId: kw.adGroupId, campaignId: group.campaignId,
        qualityScore: 0,
        qualityDetail: { expectedCtr: 'average', adRelevance: 'average', landingPage: 'average' },
        topImpressions: 0, absTopImpressions: 0, avgPosition: 0,
        eligible: 0, lostToRank: 0, lostToBudget: 0,
        state: 'eligible',
      };
      keywordDay.set(kw.id, row);
    }
    return row;
  };

  const ensurePmaxDay = (campaignId: string): GDayMetrics => {
    let row = pmaxDay.get(campaignId);
    if (!row) { row = emptyDayMetrics(); pmaxDay.set(campaignId, row); }
    return row;
  };

  const recordQuality = (keywordId: string, quality: Quality) => {
    let t = qualityTotals.get(keywordId);
    if (!t) {
      t = { sum: 0, n: 0, top: quality, topN: 0, counts: new Map() };
      qualityTotals.set(keywordId, t);
    }
    t.sum += quality.score;
    t.n += 1;
    const seen = (t.counts.get(quality) ?? 0) + 1;
    t.counts.set(quality, seen);
    if (seen > t.topN) { t.topN = seen; t.top = quality; }
  };

  // ── The day, as a sequence of searches ──────────────────────────────────
  //
  // Every search that will happen today, in the order it happens.
  //
  // Built for the whole query universe whether or not the account can serve it,
  // and ordered by clock time rather than by position in the source file. Both
  // choices matter. Ordering by clock time is what lets a budget run out partway
  // through a day instead of being eaten by whichever query happened to be
  // declared first. Building it unconditionally is what makes the sequence — and
  // therefore every rival draw in it — identical no matter what the learner
  // changes, so two runs of the same day face the same market and only the account
  // differs. Without that, no comparison in the calibration gate would mean
  // anything at all.
  const events: { q: number; t: number }[] = [];
  for (let qi = 0; qi < next.queries.length; qi++) {
    const query = next.queries[qi];
    const rng = streamFor(opts.seed, day, `q:${query.id}`);
    const volume = searchesToday(query, weekdayIndex, rng);
    for (let n = 0; n < volume; n++) events.push({ q: qi, t: drawSearchTime(rng()) });
  }
  events.sort((a, b) => a.t - b.t);

  // Which of the account's keywords can serve each query. Worked out once per
  // query rather than once per search, since nothing about it changes within a day.
  const plans = next.queries.map((query) => {
    const eligible = eligibleKeywords(query, liveSearchKeywords, keywordOwner, next.negatives);
    const perCampaign = winnerPerCampaign(eligible, (id) => keywordOwner(id)?.campaignId);
    // Performance Max honours negatives too — that is what a brand exclusion is,
    // and it is the actual fix for the cannibalisation further down.
    const pmax = livePmax.filter((c) =>
      !negativesFor(next.negatives, c.id, '').some((n) => negativeBlocks(n, query)));
    return { query, perCampaign, pmax, serves: perCampaign.size > 0 || pmax.length > 0 };
  });

  const daySeed = (opts.seed ^ Math.imul(day + 1, 0x9e3779b1) ^ stringSeed('auction')) | 0;

  for (let i = 0; i < events.length; i++) {
    const plan = plans[events[i].q];
    if (!plan.serves) continue;
    const { query } = plan;
    const clock = events[i].t;

    // One stream per search, derived from where the search sits in the day rather
    // than from anything about the account. Cheap to make, and stable under every
    // edit a learner can perform.
    const rng = mulberry32((daySeed ^ Math.imul(i + 1, 0x85ebca6b)) | 0);

    // The opposition for this one search, drawn once and faced by everybody.
    const rivalRanks = drawRivals(query, next.conditions.marketPressure, rng);
    const entrants: Entrant[] = [];

    // What a campaign is allowed to have spent by this hour. Google paces: it does
    // not spend a daily budget the moment demand exists, it spreads it across the
    // day's traffic and throttles once it is running ahead.
    const allowance = (c: GCampaign) =>
      c.dailyBudget * Math.min(1, GMODEL.pacingHeadroom + dayShareAt(clock) * GMODEL.pacingSlack);

    const throttled = (c: GCampaign) => {
      const spent = spendByCampaign.get(c.id) ?? 0;
      if (spent < allowance(c)) return false;
      // Genuinely out of money for the day, as opposed to merely ahead of pace.
      if (spent >= c.dailyBudget * 0.98) cappedCampaigns.add(c.id);
      return true;
    };

    // ── Search campaigns ──
    for (const [campaignId, entry] of plan.perCampaign) {
      const campaign = campaignById.get(campaignId)!;
      const group = adGroupById.get(entry.keyword.adGroupId)!;
      const ads = adsByGroup.get(group.id) ?? [];

      const row = ensureKeywordDay(entry.keyword);
      row.eligible++;
      entry.keyword.runtime.eligibleAuctions++;

      // Budget is checked before entering, so a throttled campaign's misses are
      // counted as lost to budget rather than silently not happening.
      if (throttled(campaign)) {
        row.lostToBudget++;
        entry.keyword.runtime.lostToBudget++;
        continue;
      }

      const cacheKey = `${entry.keyword.id}|${query.id}`;
      let quality = qualityCache.get(cacheKey);
      if (!quality) {
        quality = computeQuality({
          keyword: entry.keyword, adGroup: group, ads, query, matchRelevance: entry.relevance,
        });
        qualityCache.set(cacheKey, quality);
      }
      recordQuality(entry.keyword.id, quality);

      const dataDays = day - campaign.runtime.strategyChangedDay;
      const bid = bidFor(
        campaign, group, entry.keyword, query,
        next.conditions.conversionValue, next.conditions.siteQuality,
        entry.relevance, dataDays, meanWorth, next.conditions.margin, rng,
      );

      entrants.push({
        campaignId, campaign, keyword: entry.keyword,
        exact: entry.keyword.match === 'exact',
        relevance: entry.relevance, quality, bid,
        rank: adRank(bid, quality),
      });
    }

    // ── Performance Max ──
    for (const campaign of plan.pmax) {
      const relevance = pmaxRelevance(query, campaign.pmaxReach ?? 1, rng);
      if (relevance === null) continue;
      if (throttled(campaign)) continue;

      const worth = clickValue(
        query, next.conditions.conversionValue, next.conditions.siteQuality, relevance,
      );
      const bid = Math.max(1, worth * next.conditions.margin
        * GMODEL.smartBiddingAggression * jitter(rng, 0.25));
      const quality: Quality = {
        score: 7,
        factor: Math.max(0.25, relevance * GMODEL.pmaxQualityBonus),
        detail: { expectedCtr: 'average', adRelevance: 'average', landingPage: 'average' },
      };

      entrants.push({
        campaignId: campaign.id, campaign, exact: false, relevance, quality, bid,
        rank: adRank(bid, quality),
      });
    }

    if (entrants.length === 0) continue;

    // ── One ad per advertiser ────────────────────────────────────────────
    //
    // Google will not show two of your ads in one auction, so your campaigns
    // resolve against each other before facing anybody else. The rule is the real
    // one: an exact-match Search keyword for this query takes precedence over
    // Performance Max; otherwise the highest Ad Rank serves.
    //
    // This is the whole cannibalisation lesson in four lines. PMax bids what a
    // brand click is worth — which is a lot — so it out-ranks a Search brand
    // campaign, that campaign's impression share collapses, and the one report
    // that would explain why is the one PMax does not give you. An exact-match
    // brand keyword, or a brand exclusion on PMax, hands it straight back.
    const exactPool = entrants.filter((e) => e.exact);
    const pool = exactPool.length > 0 ? exactPool : entrants;
    const winner = pool.reduce((a, b) => (b.rank > a.rank ? b : a));

    // Everybody else in the account lost this auction on rank. Google reports it
    // exactly that way, so the losing keyword's impression share reflects it.
    for (const e of entrants) {
      if (e === winner || !e.keyword) continue;
      const row = ensureKeywordDay(e.keyword);
      row.lostToRank++;
      e.keyword.runtime.lostToRank++;
    }

    const outcome = resolveAuction({
      bid: winner.bid, quality: winner.quality, myRank: winner.rank, rivalRanks, query,
    });

    const row = winner.keyword ? ensureKeywordDay(winner.keyword) : undefined;

    if (!outcome.shown) {
      if (row && winner.keyword) {
        row.lostToRank++;
        winner.keyword.runtime.lostToRank++;
      }
      continue;
    }

    // ── An impression ──
    const pmaxRow = winner.keyword ? undefined : ensurePmaxDay(winner.campaignId);
    if (row && winner.keyword) {
      row.impressions++;
      // Google reports where an ad landed as two shares rather than a position:
      // was it in the block above the organic results, and was it first in it.
      if (outcome.position <= GMODEL.topSlots) row.topImpressions++;
      if (outcome.position === 1) row.absTopImpressions++;
      winner.keyword.runtime.impressions++;
      const pos = positionTotals.get(winner.keyword.id) ?? { sum: 0, n: 0 };
      pos.sum += outcome.position; pos.n++;
      positionTotals.set(winner.keyword.id, pos);
    } else if (pmaxRow) {
      pmaxRow.impressions++;
    }

    // The search terms report records the impression, not only the click — which
    // is how you find a query burning your budget without ever converting.
    // Performance Max is deliberately absent from it, exactly as in the product.
    const term = winner.keyword
      ? touchTerm(searchTerms, query, winner.keyword.id, winner.campaignId)
      : undefined;
    const insight = winner.keyword
      ? undefined
      : touchInsight(pmaxInsights, query, winner.campaignId);
    if (term) term.impressions++;
    if (insight) insight.impressions++;

    const ctr = ctrForPosition(outcome.position, winner.quality, query) / 100;
    if (rng() >= ctr) continue;

    // ── A click ──
    const cost = outcome.cpc;
    spendByCampaign.set(winner.campaignId, (spendByCampaign.get(winner.campaignId) ?? 0) + cost);
    if (row && winner.keyword) {
      row.clicks++; row.cost += cost;
      winner.keyword.runtime.clicks++; winner.keyword.runtime.cost += cost;
    } else if (pmaxRow) {
      pmaxRow.clicks++; pmaxRow.cost += cost;
    }
    if (term) { term.clicks++; term.cost += cost; }
    if (insight) { insight.clicks++; insight.cost += cost; }

    // ── A conversion, maybe ──
    if (rng() < conversionRate(query, next.conditions.siteQuality, winner.relevance)) {
      const value = next.conditions.conversionValue;
      if (row && winner.keyword) {
        row.conversions++; row.convValue += value;
        winner.keyword.runtime.conversions++;
        winner.keyword.runtime.convValue += value;
      } else if (pmaxRow) {
        pmaxRow.conversions++; pmaxRow.convValue += value;
      }
      if (term) { term.conversions++; term.convValue += value; }
      if (insight) { insight.conversions++; insight.convValue += value; }
    }
  }

  // ── Roll everything up ──────────────────────────────────────────────────
  const keywordResults: KeywordDayResult[] = [];
  for (const [keywordId, row] of keywordDay) {
    const kw = keywordById.get(keywordId)!;
    const q = qualityTotals.get(keywordId);
    if (q && q.n > 0) {
      row.qualityScore = Math.round(q.sum / q.n);
      row.qualityDetail = q.top.detail;
    }
    const pos = positionTotals.get(keywordId);
    row.avgPosition = pos && pos.n > 0 ? pos.sum / pos.n : 0;
    row.state = keywordStateFor(kw, row, row.qualityScore);
    kw.runtime.state = row.state;

    // Historical CTR, which is the memory Quality Score is built from — stored
    // position-normalised, as what this ad would have earned at the top of the
    // page. Storing the raw figure would score a keyword down for sitting where
    // its own low score put it, and nothing could ever climb back out.
    if (row.impressions > 0) {
      const decay = GMODEL.ctrPositionDecay ** (Math.max(1, row.avgPosition) - 1);
      const dayCtr = (row.clicks / row.impressions) / decay;
      const prior = kw.runtime.ctrSamples;
      kw.runtime.ctrEma = prior > 0 ? kw.runtime.ctrEma * 0.82 + dayCtr * 0.18 : dayCtr;
      kw.runtime.ctrSamples = prior + row.impressions;
    }

    addInto(account, row);
    keywordResults.push(row);
  }

  const campaignResults: CampaignDayResult[] = next.campaigns.map((c) => {
    const totals = c.type === 'search'
      ? keywordResults
        .filter((k) => k.campaignId === c.id)
        .reduce((acc, k) => { addInto(acc, k); return acc; }, emptyDayMetrics())
      : { ...(pmaxDay.get(c.id) ?? emptyDayMetrics()) };

    if (c.type !== 'search') addInto(account, totals);

    // The campaign's lifetime totals, which the interface reports alongside the day.
    addInto(c.runtime, totals);

    return {
      ...totals,
      campaignId: c.id,
      budget: c.dailyBudget,
      budgetCapped: cappedCampaigns.has(c.id),
    };
  });

  // Trailing conversions, the window Smart Bidding actually learns from.
  for (const c of next.campaigns) {
    const own = campaignResults.find((r) => r.campaignId === c.id);
    c.runtime.trailingConversions = [...c.runtime.trailingConversions, own?.conversions ?? 0].slice(-30);
  }

  next.day = day + 1;
  return {
    state: next,
    result: {
      day,
      account,
      campaigns: campaignResults,
      keywords: keywordResults,
      searchTerms: Array.from(searchTerms.values()),
      pmaxInsights: Array.from(pmaxInsights.values()),
    },
  };
}

function addInto(target: GDayMetrics, from: GDayMetrics): void {
  target.impressions += from.impressions;
  target.clicks += from.clicks;
  target.cost += from.cost;
  target.conversions += from.conversions;
  target.convValue += from.convValue;
}

function touchTerm(
  map: Map<string, SearchTermRow>,
  query: SearchQuery,
  keywordId: string,
  campaignId: string,
): SearchTermRow {
  const key = `${query.id}|${keywordId}`;
  let row = map.get(key);
  if (!row) {
    row = {
      ...emptyDayMetrics(),
      queryId: query.id, text: query.text, keywordId, campaignId,
    };
    map.set(key, row);
  }
  return row;
}

function touchInsight(
  map: Map<string, PmaxInsightRow>,
  query: SearchQuery,
  campaignId: string,
): PmaxInsightRow {
  const category = insightCategory(query);
  const key = `${campaignId}|${category}`;
  let row = map.get(key);
  if (!row) {
    row = { ...emptyDayMetrics(), campaignId, category };
    map.set(key, row);
  }
  return row;
}

/** What the interface says about a keyword, which is the first thing a learner
 *  should read and the last thing most people look at. */
function keywordStateFor(kw: GKeyword, row: KeywordDayResult, qualityScore: number): KeywordState {
  if (kw.status !== 'active') return 'paused';
  if (row.eligible === 0) return 'low_volume';
  if (row.impressions === 0 && qualityScore > 0 && qualityScore <= 3) return 'rarely_shown_quality';
  if (row.impressions === 0 && row.lostToRank > 0) return 'below_first_page';
  return 'eligible';
}

/** Runs `days` consecutive ticks. */
export function run(
  state: GState,
  days: number,
  opts: GTickOptions,
): { state: GState; results: GDayResult[] } {
  let cur = state;
  const results: GDayResult[] = [];
  for (let i = 0; i < days; i++) {
    const step = tick(cur, opts);
    cur = step.state;
    results.push(step.result);
  }
  return { state: cur, results };
}
