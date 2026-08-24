/**
 * The simulator's data model and tuning constants.
 *
 * This is the shape the engine ticks over. It deliberately mirrors Meta's own
 * hierarchy (Campaign > Ad set > Ad, with the audience attached at the ad set
 * because that is where Meta actually does targeting and delivery) so that
 * muscle memory built here transfers to the real tool.
 *
 * Everything here is plain data: no DB types, no React, no I/O. The engine is a
 * pure function of (state, day, seed), which is what makes it replayable,
 * testable, and calibratable. Persistence wraps it, never the other way round.
 */

// ─────────────────────────────────────────────────────────────── enumerations ──

/** Meta's real campaign objectives. Note this is NOT the same axis as the
 *  prospecting/retargeting/catalog labels the old demo data used: those describe
 *  *strategy* and survive as `strategyTag` below, because the dashboard's filters
 *  and funnel rates key off them. */
export type Objective =
  | 'awareness' | 'traffic' | 'engagement' | 'leads' | 'app_promotion' | 'sales';

export const OBJECTIVE_LABEL: Record<Objective, string> = {
  awareness: 'Awareness',
  traffic: 'Traffic',
  engagement: 'Engagement',
  leads: 'Leads',
  app_promotion: 'App promotion',
  sales: 'Sales',
};

/** Where the budget lives. The single most consequential structural choice a
 *  media buyer makes, and the subject of Learn module 4.1. */
export type BudgetMode = 'cbo' | 'abo';

export type BidStrategy = 'highest_volume' | 'cost_cap';

export type EntityStatus = 'active' | 'paused' | 'archived';

/** Delivery state as Ads Manager reports it. `limited` is the one that costs real
 *  money: an ad set that cannot reach ~50 events a week never stabilises. */
export type DeliveryState = 'learning' | 'active' | 'limited' | 'paused' | 'not_delivering';

export type StrategyTag = 'prospecting' | 'retargeting' | 'catalog';

export type AudienceType = 'saved' | 'custom' | 'lookalike' | 'dynamic';

export type AdFormat = 'image' | 'video' | 'carousel' | 'collection';

/** The conversion the ad set optimises toward. Optimising for a rarer event makes
 *  the 50-event threshold harder to clear, which is exactly the trade-off module
 *  4.2 teaches ("optimise for Add to Cart until volume grows"). */
export type OptimisationEvent = 'purchase' | 'add_to_cart' | 'landing_page_view' | 'link_click' | 'lead';

/** Roughly how often each event happens relative to a purchase. Used to convert an
 *  ad set's purchases into "optimisation events" for the learning-phase count. */
export const EVENT_FREQUENCY_MULTIPLIER: Record<OptimisationEvent, number> = {
  purchase: 1,
  add_to_cart: 3.2,
  landing_page_view: 9,
  link_click: 14,
  lead: 2.4,
};

// ────────────────────────────────────────────────────────────────── entities ──

export interface SimAudience {
  id: string;
  name: string;
  type: AudienceType;
  /** Addressable people. Drives both CPM (scarcity) and how fast you saturate. */
  size: number;
  /** 0 = ice cold (broad interest), 1 = hottest (7-day cart abandoners). Drives
   *  baseline CTR and CVR, and the CPM premium warm pools carry. */
  warmth: number;
  /** Set when this audience derives from another (lookalike seed, or a retargeting
   *  window nested inside a wider one). Two audiences sharing a root compete with
   *  each other in the auction: see `overlapPenalty` in auction.ts. */
  overlapGroup?: string;
  spec?: AudienceSpec;
}

export interface AudienceSpec {
  ageMin: number;
  ageMax: number;
  genders: 'all' | 'men' | 'women';
  geos: string[];
  interests: string[];
}

export interface SimCampaign {
  id: string;
  name: string;
  objective: Objective;
  budgetMode: BudgetMode;
  /** Only meaningful when budgetMode is 'cbo'. Rupees per day. */
  dailyBudget?: number;
  bidStrategy: BidStrategy;
  /** Only meaningful when bidStrategy is 'cost_cap'. */
  costCap?: number;
  status: EntityStatus;
  strategyTag: StrategyTag;
  createdDay: number;
}

export interface SimAdSet {
  id: string;
  campaignId: string;
  name: string;
  audienceId: string;
  /** Only meaningful when the parent campaign is 'abo'. */
  dailyBudget?: number;
  optimisationEvent: OptimisationEvent;
  /** Advantage+ (automatic) placements deliver cheaper but give less control. */
  advantagePlacements: boolean;
  status: EntityStatus;
  createdDay: number;
  runtime: AdSetRuntime;
}

export interface SimAd {
  id: string;
  adSetId: string;
  name: string;
  creativeId: string;
  format: AdFormat;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  destinationUrl: string;
  status: EntityStatus;
  createdDay: number;
  runtime: AdRuntime;
}

/**
 * What the model reads off a creative. The visual and copy a learner picks are
 * presentation; these four numbers are what actually move delivery, and they are
 * deliberately hidden from the UI so the learner has to infer creative quality
 * from performance the way they would on a real account.
 */
export interface CreativeAttributes {
  /** Multiplier on baseline CTR. Some creative is simply better. */
  baseCtrMultiplier: number;
  /** How fast CTR decays as frequency climbs. UGC holds up; hard-sell statics burn. */
  fatigueRate: number;
  /** Multiplier applied on cold audiences (>1) vs warm (<1), or the reverse. A
   *  founder-story video earns attention cold; a "still thinking it over?" nudge
   *  only makes sense to someone who already visited. */
  coldAffinity: number;
  /** Drives early retention, and therefore both CTR and the auction quality score. */
  hookStrength: number;
}

// ─────────────────────────────────────────────────────────────────── runtime ──
//
// Cumulative counters carried on the entity rather than re-derived from the day
// log. Fatigue and saturation both depend on total history, so keeping the
// running totals here means `tick` needs only the current state as input and
// stays a small, pure step function.

export interface AdRuntime {
  impressions: number;
  clicks: number;
  spend: number;
  purchases: number;
  revenue: number;
}

export interface AdSetRuntime extends AdRuntime {
  /** Cumulative unique people reached. Grows sub-linearly, see delivery.ts. */
  reach: number;
  /** Optimisation events per day, most recent last. Only the trailing 7 matter. */
  trailingEvents: number[];
  /** The day the learning phase last restarted. A significant edit resets it, which
   *  is how "every edit has a cost" (module 6.3) becomes a mechanic, not advice. */
  learningResetDay: number;
  learningState: 'learning' | 'active' | 'limited';
  /** Exponential moving average of recent daily budget. Delivery is tuned to the
   *  spend level it has been running at; a sudden jump well above this forces it to
   *  buy inventory it would otherwise have passed over. See `budgetShock`. */
  budgetEma: number;
  /** Share of its campaign's budget this ad set received yesterday, under CBO.
   *  Delivery has inertia: Meta keeps feeding what it is already feeding, so an
   *  early lead compounds into a dominant share. Without this the allocator just
   *  re-rolls every day and never actually picks a winner, which is the opposite
   *  of the behaviour module 4.1 warns learners about. */
  cboShare: number;
}

export function emptyAdRuntime(): AdRuntime {
  return { impressions: 0, clicks: 0, spend: 0, purchases: 0, revenue: 0 };
}

export function emptyAdSetRuntime(createdDay = 0): AdSetRuntime {
  return {
    ...emptyAdRuntime(),
    reach: 0,
    trailingEvents: [],
    learningResetDay: createdDay,
    learningState: 'learning',
    budgetEma: 0,
    cboShare: 0,
  };
}

// ───────────────────────────────────────────────────────────────── the world ──

/** Account-level properties the learner does not directly control but which the
 *  model reads every day. Mission events mutate these (a broken checkout script
 *  drops `landingPageQuality`), which is how a downstream problem can present as
 *  an ads problem: the exact diagnostic skill module 6.2 teaches. */
export interface AccountConditions {
  /** Average order value in rupees. */
  aov: number;
  /** Multiplier on conversion rate. 1.0 = healthy. A broken checkout is ~0.5. */
  landingPageQuality: number;
  /** Multiplier on CPM. Competitive pressure, sale seasons, festival periods. */
  marketPressure: number;
}

export interface SimState {
  /** Day index since the account opened. Advanced by the tick. */
  day: number;
  conditions: AccountConditions;
  audiences: SimAudience[];
  campaigns: SimCampaign[];
  adSets: SimAdSet[];
  ads: SimAd[];
}

// ────────────────────────────────────────────────────────────────── results ──

/** One entity's numbers for one day. Rolls up to campaign and account. */
export interface DayMetrics {
  spend: number;
  impressions: number;
  linkClicks: number;
  purchases: number;
  revenue: number;
  reach: number;
}

export function emptyDayMetrics(): DayMetrics {
  return { spend: 0, impressions: 0, linkClicks: 0, purchases: 0, revenue: 0, reach: 0 };
}

export interface AdDayResult extends DayMetrics {
  adId: string;
  /** Frequency this creative has reached against its ad set's audience so far.
   *  Surfaced because it is the leading indicator of fatigue. */
  creativeFrequency: number;
}

export interface AdSetDayResult extends DayMetrics {
  adSetId: string;
  campaignId: string;
  cpm: number;
  frequency: number;
  delivery: DeliveryState;
  /** Trailing-7-day optimisation events, the number the 50-event rule reads. */
  trailingEvents: number;
  ads: AdDayResult[];
}

export interface DayResult {
  day: number;
  adSets: AdSetDayResult[];
  account: DayMetrics;
}

// ─────────────────────────────────────────────────────────────── tuning ──
//
// Calibrated against realistic Indian D2C paid-social bands. These are the knobs
// the calibration script in scripts/validate-simulator.ts holds to account: the
// tests assert the *relationships* the curriculum teaches (narrow costs more,
// fatigue erodes CTR, consolidation escapes learning) rather than exact figures,
// so these can be retuned without rewriting the tests.

export const MODEL = {
  /** CPM for a broad, cold audience with average creative, before any pressure. */
  baseCpm: 118,
  /** Audience size that `baseCpm` describes. Smaller pools cost more. */
  referenceAudienceSize: 4_000_000,
  /** How sharply CPM rises as the audience narrows. */
  scarcityExponent: 0.27,
  scarcityMax: 6,

  /** Link CTR (%) at warmth 0 and warmth 1, interpolated between.
   *  Calibrated against the frozen case-study account in demo-account.ts, whose
   *  prospecting campaigns run ~1.3% and warm retargeting ~3.2%. Set these too
   *  generous and the simulated account returns a blended ROAS no real D2C brand
   *  sees, which would teach learners the wrong benchmark for "good". */
  baseCtrCold: 1.0,
  baseCtrWarm: 2.8,

  /** Conversion rate (%) from link click, at warmth 0 and 1. */
  baseCvrCold: 2.5,
  baseCvrWarm: 8.0,

  /** Frequency below which a creative shows no fatigue at all. */
  fatigueOnsetFrequency: 1.5,
  /** Default decay rate; individual creatives override via `fatigueRate`. */
  defaultFatigueRate: 0.28,

  /** How much of the remaining pool a day's impressions can newly reach. Lower =
   *  slower reach accumulation = frequency climbs faster on a fixed audience. */
  reachSaturationFactor: 0.35,

  /** CPM multiplier once frequency starts to bite. */
  frequencyPressurePerPoint: 0.09,

  /** Extra CPM each additional ad set sharing an audience pool inflicts on all of
   *  them. This is you bidding against yourself (module 7.2). */
  overlapPenaltyPerSibling: 0.12,

  /** Optimisation events in a trailing 7-day window needed to exit learning. */
  learningEventThreshold: 50,
  /** Days after a reset before an under-threshold ad set is called 'limited'
   *  rather than still 'learning'. */
  learningGraceDays: 7,
  /** What being stuck in learning costs: pricier delivery, worse conversion. */
  learningCpmPenalty: 1.15,
  learningCvrPenalty: 0.85,

  /** How hard CBO concentrates budget on early front-runners. Higher = more
   *  winner-take-all, which is what starves untested ad sets (module 4.1). */
  cboConcentration: 2.5,
  /** Floor share so a brand-new ad set in a CBO campaign gets *some* budget. */
  cboMinShare: 0.03,
  /** How strongly yesterday's allocation pulls today's. Delivery inertia is what
   *  turns an arbitrary early lead into a permanent one, so this is the constant
   *  that makes CBO genuinely unsuitable for testing. */
  cboMomentum: 2.6,

  /** A budget change larger than this fraction resets the learning phase. */
  significantBudgetChange: 0.3,

  /** Budget shock. Spending far above the level delivery has settled into means
   *  buying impressions the auction would otherwise have skipped: pricier, and
   *  from people less likely to convert. This is the mechanism behind module 7.1's
   *  warning that an overnight jump "forces delivery into worse inventory", and it
   *  is separate from (and additive to) the learning-phase reset a big edit causes.
   *  How fast the EMA catches up is how fast a new spend level becomes the norm. */
  budgetEmaAlpha: 0.25,
  /** Ratio above which a jump starts to hurt at all. */
  budgetShockThreshold: 1.3,
  budgetShockCpmPerPoint: 0.20,
  budgetShockCvrPerPoint: 0.14,
  budgetShockCvrMax: 0.35,

  /** Day-to-day randomness. Delivery is noisy; a model without noise teaches
   *  learners to over-read single days, which is the opposite of module 5.3. */
  dailyNoise: 0.14,
  /** Learning-phase delivery is markedly more erratic than stable delivery. */
  learningNoiseMultiplier: 2.2,

  /** Advantage+ placements deliver a little cheaper (more inventory to choose). */
  advantagePlacementCpmDiscount: 0.93,

  /** Spend pacing: an ad set rarely spends its budget to the rupee. */
  pacingFloor: 0.86,
  pacingCeiling: 1.0,
} as const;

/** D2C streetwear skews to the weekend: people browse and buy off the clock.
 *  Index 0 = Sunday. Carried over from the original demo series so the simulated
 *  account and the frozen case study share one rhythm. */
export const WEEKDAY_WEIGHT = [1.15, 0.82, 0.85, 0.88, 0.92, 1.05, 1.28] as const;
