/**
 * The Google Ads simulator's data model and tuning constants.
 *
 * Mirrors Google's own hierarchy (Campaign > Ad group > Keyword + Ad) so muscle
 * memory transfers, but the object at the centre is not the ad set — it is the
 * **query**. On Meta you buy an audience; here you buy a search, and everything
 * from match types through Quality Score through the search terms report is
 * downstream of that one fact.
 *
 * Plain data only: no DB types, no React, no I/O. The engine is a pure function of
 * (state, day, seed), which is what makes it replayable and calibratable.
 */

// ─────────────────────────────────────────────────────────────── enumerations ──

/** Google's real campaign types. Search is the one a learner starts with; PMax is
 *  modelled because its lesson only exists when it runs *beside* Search in the
 *  same account and quietly eats its traffic. */
export type GCampaignType = 'search' | 'pmax' | 'app' | 'shopping';

export const CAMPAIGN_TYPE_LABEL: Record<GCampaignType, string> = {
  search: 'Search',
  pmax: 'Performance Max',
  app: 'App',
  shopping: 'Shopping',
};

/** Where an App campaign's ads can run. Not selectable — that is the point of the
 *  campaign type — but reported, which is how a learner discovers where the money
 *  went and why the installs from there never opened the app again. */
export type AppChannelId = 'search' | 'play' | 'youtube' | 'discover' | 'display';

export type MatchType = 'exact' | 'phrase' | 'broad';

export const MATCH_LABEL: Record<MatchType, string> = {
  exact: 'Exact match',
  phrase: 'Phrase match',
  broad: 'Broad match',
};

/** How a keyword is written in the interface: [exact], "phrase", broad. */
export function renderKeyword(text: string, match: MatchType): string {
  return match === 'exact' ? `[${text}]` : match === 'phrase' ? `"${text}"` : text;
}

export type GBidStrategy =
  | 'manual_cpc'
  | 'maximise_clicks'
  | 'maximise_conversions'
  | 'target_cpa'
  | 'target_roas';

export const BID_STRATEGY_LABEL: Record<GBidStrategy, string> = {
  manual_cpc: 'Manual CPC',
  maximise_clicks: 'Maximise clicks',
  maximise_conversions: 'Maximise conversions',
  target_cpa: 'Target CPA',
  target_roas: 'Target ROAS',
};

/** Whether a strategy needs conversion data to work at all. Used by the engine to
 *  decide how much of a penalty a data-starved account pays for automating. */
export const STRATEGY_NEEDS_CONVERSIONS: Record<GBidStrategy, number> = {
  manual_cpc: 0,
  maximise_clicks: 0,
  maximise_conversions: 15,
  target_cpa: 30,
  target_roas: 50,
};

export type GStatus = 'active' | 'paused' | 'removed';

/** What the interface says about a keyword that is not working. */
export type KeywordState =
  | 'eligible'
  | 'below_first_page'
  | 'rarely_shown_quality'
  | 'low_volume'
  | 'paused';

// ─────────────────────────────────────────────────── the world being searched ──

/** How commercially ready a searcher is. Sets both price and conversion rate. */
export type IntentTier = 'transactional' | 'commercial' | 'informational' | 'navigational';

/**
 * One search somebody actually performs.
 *
 * `concepts` is the matching vocabulary: a set of ideas the query contains, which
 * is what keywords are matched against rather than raw substrings. That is how a
 * broad-match keyword can pick up a query sharing none of its words, which is the
 * behaviour every buyer has to learn to see coming.
 */
export interface SearchQuery {
  id: string;
  text: string;
  /** Searches per day, before weekday shape and noise. */
  volume: number;
  intent: IntentTier;
  /** Concept tokens: the meaning, not the string. */
  concepts: string[];
  /**
   * Ideas this search is *adjacent* to without containing.
   *
   * Only broad match sees these, and that is the whole point of them. Exact and
   * phrase match words; broad matches meaning, which is how a keyword can win an
   * auction for a search sharing none of its words — "trainers" for a "running
   * shoes" keyword, "bookkeeping" for "accounting software". Without a field that
   * only broad can read, broad match is merely phrase match with a lower threshold,
   * and the most important warning in the whole course has nothing behind it.
   */
  related?: string[];
  /** Multiplier on the tier's baseline conversion rate. Some queries convert far
   *  better than their tier suggests, and finding those is the whole game. */
  cvrMultiplier: number;
  /** How contested the auction is, 0.5 (quiet) to 2 (bloodbath). Drives what
   *  competitors bid. */
  competition: number;
  /** True for searches naming this brand. Cheap, high-converting, and the traffic
   *  Performance Max will happily claim as its own if you let it. */
  brand?: boolean;
}

// ────────────────────────────────────────────────────────────────── entities ──

export interface GKeyword {
  id: string;
  adGroupId: string;
  text: string;
  match: MatchType;
  /** Only meaningful under manual CPC. Rupees. */
  maxCpc?: number;
  status: GStatus;
  createdDay: number;
  runtime: KeywordRuntime;
}

export interface GNegative {
  id: string;
  /** Scope: an ad group, a campaign, or the whole account. */
  level: 'account' | 'campaign' | 'adgroup';
  /** The campaign or ad group it applies to; ignored at account level. */
  ownerId?: string;
  text: string;
  match: MatchType;
}

export interface GAd {
  id: string;
  adGroupId: string;
  /** Headlines, in the order supplied. Relevance is judged on whether the ad group's
   *  keywords appear among them, which is exactly what Google is judging. */
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  status: GStatus;
  createdDay: number;
  runtime: AdRuntime;
}

export interface GAdGroup {
  id: string;
  campaignId: string;
  name: string;
  /** Only meaningful under manual CPC; a keyword's own bid overrides it. */
  defaultCpc?: number;
  /** How well the destination answers the search: 0.6 (homepage for everything)
   *  to 1.25 (a page per theme). One of the three Quality Score components. */
  landingPageQuality: number;
  status: GStatus;
  createdDay: number;
}

export interface GCampaign {
  id: string;
  name: string;
  type: GCampaignType;
  /** Rupees per day. Google may spend up to 2x on a given day and balances over
   *  the month; the engine models the daily variance, not the monthly cap. */
  dailyBudget: number;
  bidStrategy: GBidStrategy;
  /** Target CPA in rupees, or target ROAS as a ratio (4 = 400%). */
  targetCpa?: number;
  targetRoas?: number;
  status: GStatus;
  createdDay: number;
  /** Performance Max only: how aggressively it reaches beyond Search inventory.
   *  Higher means more volume and worse average intent. */
  pmaxReach?: number;
  /** App campaigns only. Carries its own goal and assets because an App campaign
   *  has neither keywords nor bids in the sense the rest of the model means them —
   *  see engine/app.ts. Typed loosely here to keep this module free of the App
   *  channel table; `AppSettings` in that file is the real shape. */
  app?: import('./app').AppSettings;
  runtime: CampaignRuntime;
}

// ─────────────────────────────────────────────────────────────────── runtime ──

export interface AdRuntime {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  convValue: number;
}

export interface KeywordRuntime extends AdRuntime {
  /** Exponential moving average of click-through, the historical half of Quality
   *  Score. Seeded from a prior until the keyword has real history. */
  ctrEma: number;
  /** Impressions accumulated toward a trustworthy expected-CTR estimate. */
  ctrSamples: number;
  /** Auctions this keyword was eligible for, and how many it won. The two halves
   *  of impression share, which is otherwise impossible to compute honestly. */
  eligibleAuctions: number;
  lostToRank: number;
  lostToBudget: number;
  state: KeywordState;
}

export interface CampaignRuntime extends AdRuntime {
  /** Days since the bid strategy last changed materially. Smart Bidding is
   *  unstable while it re-learns, and changing targets repeatedly is how an
   *  account spends months never being stable enough to judge. */
  strategyChangedDay: number;
  /** Conversions in the trailing 30 days, which is what Smart Bidding actually
   *  has to learn from. */
  trailingConversions: number[];
}

export function emptyAdRuntime(): AdRuntime {
  return { impressions: 0, clicks: 0, cost: 0, conversions: 0, convValue: 0 };
}

export function emptyKeywordRuntime(): KeywordRuntime {
  return {
    ...emptyAdRuntime(),
    ctrEma: 0,
    ctrSamples: 0,
    eligibleAuctions: 0,
    lostToRank: 0,
    lostToBudget: 0,
    state: 'eligible',
  };
}

export function emptyCampaignRuntime(createdDay = 0): CampaignRuntime {
  return { ...emptyAdRuntime(), strategyChangedDay: createdDay, trailingConversions: [] };
}

// ───────────────────────────────────────────────────────────────── the world ──

/**
 * The business the account is selling for.
 *
 * Everything commercial hangs off this, which is what lets one engine run a D2C
 * store and a B2B SaaS without knowing the difference. A demo booking worth
 * ₹80,000 at a 20% close rate and a ₹2,000 order at 100% are the same arithmetic
 * with different numbers, and the lessons that fall out of them differ completely.
 */
export interface GAccountConditions {
  /** What one conversion is worth in revenue terms. */
  conversionValue: number;
  /** Gross margin on that value, 0..1. Sets break-even. */
  margin: number;
  /** Multiplier on conversion rate. 1 is healthy; a broken checkout is ~0.45. */
  siteQuality: number;
  /** Multiplier on every CPM/CPC. Seasonality, a competitor's raised budgets. */
  marketPressure: number;
  /** What a conversion is called in this account: 'Purchase', 'Demo booked'. */
  conversionName: string;
}

export interface GState {
  day: number;
  conditions: GAccountConditions;
  /** The searches that exist in this market. Fixed for the account's lifetime. */
  queries: SearchQuery[];
  campaigns: GCampaign[];
  adGroups: GAdGroup[];
  keywords: GKeyword[];
  negatives: GNegative[];
  ads: GAd[];
}

// ────────────────────────────────────────────────────────────────── results ──

export interface GDayMetrics {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  convValue: number;
}

export function emptyDayMetrics(): GDayMetrics {
  return { impressions: 0, clicks: 0, cost: 0, conversions: 0, convValue: 0 };
}

/** One search term as it actually appeared, for the report the course revolves
 *  around. Recorded because it happened, not derived from a keyword's totals. */
export interface SearchTermRow extends GDayMetrics {
  queryId: string;
  text: string;
  /** Which keyword pulled it in. The join that makes negatives actionable. */
  keywordId: string;
  campaignId: string;
}

export interface KeywordDayResult extends GDayMetrics {
  keywordId: string;
  adGroupId: string;
  campaignId: string;
  /** Quality Score as reported, 1..10. */
  qualityScore: number;
  qualityDetail: { expectedCtr: Grade; adRelevance: Grade; landingPage: Grade };
  /** Impressions in the block above the organic results, and in the very first
   *  slot of it. Google retired average position in 2019 precisely because these
   *  two answer the question people were misusing it to ask: not "where did I
   *  rank" but "was I above the fold, and was I first". */
  topImpressions: number;
  absTopImpressions: number;
  /** Kept because the model computes it honestly and the debriefs can explain
   *  with it. Not shown in the interface, which follows Google in retiring it. */
  avgPosition: number;
  /** Auctions entered, and the two ways they were lost. */
  eligible: number;
  lostToRank: number;
  lostToBudget: number;
  state: KeywordState;
}

export type Grade = 'below' | 'average' | 'above';

export interface CampaignDayResult extends GDayMetrics {
  campaignId: string;
  budget: number;
  /** True once the day's spend hit the campaign's ceiling, which is what makes
   *  "lost to budget" mean something. */
  budgetCapped: boolean;
}

/**
 * What Performance Max will tell you about the searches it bought.
 *
 * Deliberately not a search terms report. Google gives PMax a categories view and
 * withholds the terms themselves, which is precisely why brand cannibalisation is
 * hard to see: the traffic leaves your Search campaign, arrives in PMax, and the
 * report that would prove it does not exist. Diagnosing it means reading the
 * Search campaign's impression share instead — so the simulator has to withhold
 * the same thing the real product does, or the lesson evaporates.
 */
export interface PmaxInsightRow extends GDayMetrics {
  campaignId: string;
  /** A bucket, never a term: 'Brand', 'Transactional', 'Commercial', … */
  category: string;
}

/** One inventory channel's day inside an App campaign. */
export interface AppChannelRow extends GDayMetrics {
  channelId: AppChannelId;
  label: string;
  /** Installs, which is not the same as conversions and is the whole lesson. */
  installs: number;
  /** The in-app action the business actually wanted. */
  events: number;
}

/** An App campaign's day. Separate from CampaignDayResult because it carries two
 *  extra counts — installs and in-app actions — whose divergence is the point. */
export interface AppDayResult extends GDayMetrics {
  campaignId: string;
  installs: number;
  events: number;
  channels: AppChannelRow[];
  budget: number;
  budgetCapped: boolean;
  /** Set when the campaign could not run at all, with the reason in plain words. */
  blocked?: string;
}

export interface GDayResult {
  day: number;
  account: GDayMetrics;
  campaigns: CampaignDayResult[];
  keywords: KeywordDayResult[];
  /** Every search term that produced an impression today. Search campaigns only —
   *  Performance Max does not report them, and neither does this. */
  searchTerms: SearchTermRow[];
  /** The category-level view Performance Max offers in place of search terms. */
  pmaxInsights: PmaxInsightRow[];
  /** One entry per App campaign, with its channel breakdown. */
  apps: AppDayResult[];
}

// ─────────────────────────────────────────────────────────────────── tuning ──
//
// Calibrated against realistic Indian paid-search bands. As with the Meta engine,
// the calibration script asserts the *relationships* the curriculum teaches rather
// than exact figures, so these can move without rewriting the suite.

export const GMODEL = {
  /** Baseline CPC for a transactional query at average competition and Quality
   *  Score 5, before anything else. Search is far pricier than social. */
  baseCpc: 38,

  /** How much each intent tier multiplies the baseline price. Transactional
   *  searches cost several times what research does, and are worth it. */
  intentCpc: {
    transactional: 1.55,
    commercial: 1.0,
    informational: 0.42,
    navigational: 0.55,
  } as Record<IntentTier, number>,

  /** Conversion rate (%) from a click, by tier, before the query's own multiplier
   *  and the account's site quality. */
  intentCvr: {
    transactional: 4.6,
    commercial: 2.1,
    informational: 0.5,
    navigational: 3.4,
  } as Record<IntentTier, number>,

  /** Click-through (%) at position 1, and the decay per position after it. A
   *  first-position ad earns several times what a fourth-position one does, which
   *  is why Ad Rank matters more than it looks. */
  ctrAtTop: 9.2,
  ctrPositionDecay: 0.52,
  /** Ads above the organic results. Land outside these and you are at the bottom
   *  of the page, which serves but is barely seen — a fifth-place ad earns about
   *  seven per cent of what a first-place one does. */
  topSlots: 4,

  /** How many ad slots a results page has at all, by what the searcher wanted.
   *
   *  Google does not sell the same amount of a page for every search. A page for
   *  "buy trail running shoes" is mostly advertising; a page for "how to clean
   *  running shoes" carries one ad or none, because there is nothing to sell
   *  somebody who is not buying. Modelling that matters more than it sounds: it is
   *  half of why an account that broad-matches into research queries racks up
   *  impressions it can neither click nor convert. */
  slotsByIntent: {
    transactional: 7,
    commercial: 6,
    navigational: 4,
    informational: 2,
  } as Record<IntentTier, number>,

  /** Brand searches: cheap because your Quality Score on your own name is near
   *  perfect, and they convert better than anything else. Modest, because each
   *  query already carries its own `cvrMultiplier` — the global lever is here so
   *  brand can be tuned as a class, not so brand can be tuned twice. */
  brandQualityBonus: 2.4,
  brandCvrMultiplier: 1.35,

  /** Quality Score weighting. Expected CTR dominates, exactly as Google says. */
  qsWeightExpectedCtr: 0.5,
  qsWeightAdRelevance: 0.3,
  qsWeightLandingPage: 0.2,
  /** Where a keyword's expected CTR starts before it has history of its own. */
  ctrPriorSamples: 400,
  /** The worst ad relevance a live ad can score. Google's lowest grade is "below
   *  average", not "ineligible": a sprawling ad group still runs, it just runs
   *  expensively and near the bottom of the page. */
  adRelevanceFloor: 0.2,
  /** How much of a query's conversion rate survives when the keyword that won it
   *  barely relates to the search. The rest scales with match relevance. */
  relevanceCvrFloor: 0.35,

  /** Ad Rank has to clear this to show at all, regardless of competitors — the
   *  reserve price, which is what makes "rarely shown due to low Quality Score"
   *  possible when you are the only bidder in the auction.
   *
   *  Rank is bid × quality, so the floor reads as a sliding minimum bid: at
   *  quality 1.0 a ₹14 bid clears it, at 0.5 you need ₹28, at 0.25 you need ₹56.
   *  That sliding scale is the entire argument for fixing quality rather than
   *  raising bids, and it is why the argument eventually becomes unanswerable. */
  adRankFloor: 14,

  /** How many competitors are drawn into each auction, scaled by the query's own
   *  competition figure. */
  competitorsBase: 3.2,

  /** Broad match: how far outside a keyword's own concepts it reaches, and how
   *  much of that reach is genuinely relevant. The gap between the two is the
   *  wasted spend module 2 spends its length on. */
  broadConceptOverlap: 0.34,
  broadRelevanceDecay: 0.55,
  /** Phrase sits between the two: the meaning must be present, but modifiers and
   *  extra words are allowed. */
  phraseConceptOverlap: 0.72,

  /** Smart Bidding: how much better than a flat bid it gets once it has data, and
   *  how badly it performs before it does. */
  /**
   * How hard a value-based strategy bids, as a share of the gross margin on the
   * revenue it expects from a click.
   *
   * Under 1 so that a click bought at the strategy's own valuation is profitable
   * rather than exactly break-even. There is deliberately no "lift" above true
   * value anywhere in the model: automation's advantage is that it bids the *right*
   * amount on each search, not a larger amount on all of them, and encoding a lift
   * would make a trained strategy worse than an untrained one for the silly reason
   * that it overpaid more confidently.
   */
  smartBiddingAggression: 0.9,
  /**
   * How much *less* a data-starved strategy bids on average.
   *
   * Deliberately close to 1. A cold bid strategy is not systematically timid —
   * that would make "switch to Smart Bidding" a reliable way to cut costs, which
   * is not what happens and not what anybody reports. What it is, is *wrong*, and
   * the cost of being wrong lives in `smartBiddingBlindSpread` below rather than
   * here. Leaving a large discount here would also make the lesson unmeasurable on
   * a budget-limited account, where bidding less always looks like a win.
   */
  smartBiddingStarvedPenalty: 0.95,
  /**
   * How far a data-starved bid strategy's predictions collapse toward the average.
   *
   * The half of Smart Bidding that a discount cannot express, and the reason a cold
   * strategy is dangerous rather than merely slow.
   *
   * A model with no conversions to learn from does not have opinions about
   * individual searches — it has one opinion about the account, and applies it
   * everywhere. So it decides a repair query is worth roughly what a purchase query
   * is worth, bids accordingly, and buys the repair query. In the same motion it
   * decides the long-tail search that converts at three times the average is worth
   * about average, underbids it, and loses it to somebody paying attention.
   *
   * That is regression to the mean, and it is a far better model of cold automation
   * than random noise is: noise cannot promote a worthless query past the reserve
   * price, and regression does it every time. At 0.72 a cold strategy's estimate of
   * any query is nearly three-quarters the account average and barely a quarter the
   * truth. It closes to zero as conversions accumulate, which is the entire argument
   * for feeding a strategy before trusting it.
   */
  smartBiddingShrink: 0.72,
  /** A smaller idiosyncratic error on top, so the model is noisy as well as
   *  regressive. Drawn per campaign and query and held, not per auction. */
  smartBiddingBlindSpread: 0.4,
  /** Days of instability after a strategy or target change. */
  strategyLearningDays: 7,
  strategyLearningPenalty: 0.82,

  /** A target set far below what the account achieves does not deliver a miracle;
   *  it suppresses delivery. This is the fraction of auctions a target this
   *  aggressive disqualifies. */
  aggressiveTargetChoke: 0.72,

  /** Performance Max. `pmaxReach` scales how far past Search inventory it goes;
   *  the intent of what it finds out there degrades with distance. */
  /** How much of the brand demand Performance Max wants.
   *
   *  Close to all of it, which is what it does. Brand searches are the cheapest,
   *  best-converting inventory in any account, and a system told to maximise
   *  conversions with no instruction to leave them alone will take as many as it
   *  can reach. Modelling it as a coin flip would make the cannibalisation a
   *  statistical curiosity rather than the thing that happens the week you launch. */
  pmaxBrandAppetite: 0.92,
  pmaxOutsideIntentPenalty: 0.44,
  pmaxQualityBonus: 1.15,

  /** Day-to-day randomness. */
  dailyNoise: 0.16,

  /** Budget pacing. Google does not spend a daily budget the moment it can; it
   *  spreads it across the day and throttles once it is ahead of schedule. These
   *  two numbers are that throttle: a campaign may spend `pacingHeadroom` of its
   *  budget immediately, and thereafter `pacingSlack` times the share of the day's
   *  traffic that has already happened.
   *
   *  This is what makes "lost impression share (budget)" an honest measurement
   *  rather than a ratio. A budget-limited campaign declines real auctions, spread
   *  through the day, and the count of them is the number the report shows. */
  pacingHeadroom: 0.05,
  pacingSlack: 1.2,
} as const;

/** Search is a weekday business in a way social is not: B2B especially collapses
 *  at weekends, and even retail research shifts. Index 0 = Sunday. */
export const G_WEEKDAY_WEIGHT = [0.78, 1.12, 1.14, 1.11, 1.06, 0.98, 0.81] as const;

/**
 * When people search, hour by hour, starting at midnight.
 *
 * Present for one reason: budgets. A day's searches have to happen in an order for
 * a budget to run out partway through it, and if that order were the order queries
 * happen to sit in the array, then whichever query was declared first would eat the
 * budget and the account's whole composition would be an artefact of the source
 * file. Interleaving searches across a real day removes that, and gives budget
 * pacing something true to pace against.
 */
export const G_HOUR_WEIGHT = [
  0.22, 0.14, 0.09, 0.07, 0.08, 0.14, 0.28, 0.52,
  0.86, 1.24, 1.52, 1.58, 1.44, 1.38, 1.46, 1.55,
  1.60, 1.52, 1.38, 1.30, 1.28, 1.12, 0.78, 0.45,
] as const;

/** Cumulative share of the day's searches completed by the end of each hour. */
export const G_HOUR_CUMULATIVE: number[] = (() => {
  const total = G_HOUR_WEIGHT.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let acc = 0;
  for (const w of G_HOUR_WEIGHT) { acc += w / total; out.push(acc); }
  return out;
})();

/** Share of the day's searches completed by clock time `t` (hours, 0..24). */
export function dayShareAt(t: number): number {
  if (t <= 0) return 0;
  if (t >= 24) return 1;
  const hour = Math.floor(t);
  const before = hour === 0 ? 0 : G_HOUR_CUMULATIVE[hour - 1];
  return before + (G_HOUR_CUMULATIVE[hour] - before) * (t - hour);
}

/** Draws a clock time for one search, shaped by the hour curve. */
export function drawSearchTime(u: number): number {
  const target = Math.min(0.999999, Math.max(0, u));
  for (let h = 0; h < 24; h++) {
    if (target <= G_HOUR_CUMULATIVE[h]) {
      const before = h === 0 ? 0 : G_HOUR_CUMULATIVE[h - 1];
      const span = G_HOUR_CUMULATIVE[h] - before;
      return h + (span > 0 ? (target - before) / span : 0);
    }
  }
  return 23.999;
}
