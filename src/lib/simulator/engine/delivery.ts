/**
 * The tick: one simulated day.
 *
 * This is the loop the whole Run tier exists to provide. Given an account's
 * current state it decides, for every live ad set, what the auction charged, how
 * many people it reached, how many of them clicked, and how many bought. Then it
 * advances the clock.
 *
 * Ordering matters and is deliberate:
 *   1. budget is allocated (ABO reads ad set budgets, CBO lets Meta concentrate)
 *   2. spend is paced against that budget
 *   3. each ad buys impressions at its own CPM, because CPM depends on creative
 *   4. the ad set's impressions land on one shared audience pool, growing reach
 *   5. reach and impressions give frequency, which feeds *tomorrow's* CPM
 *
 * Step 5 uses yesterday's frequency rather than today's, which avoids a circular
 * dependency and is also how saturation actually feels: pressure accumulates from
 * exposure already bought, not from the impression being priced right now.
 */

import {
  emptyDayMetrics,
  MODEL,
  type AdDayResult,
  type AdSetDayResult,
  type CreativeAttributes,
  type DayResult,
  type DeliveryState,
  type SimAd,
  type SimAdSet,
  type SimAudience,
  type SimState,
} from './types';
import { computeCpm } from './auction';
import { computeLinkClicks, computePurchases, newReach } from './response';
import { budgetsForCampaign, paceSpend } from './budget';
import { learningStateFor, isPenalised, optimisationEvents, pushTrailing, trailingEventTotal } from './learning';
import { jitter, streamFor, type Rng } from './rng';
import { budgetShock, updateBudgetEma } from './shock';

export interface TickOptions {
  seed: number;
  /** Looks up the hidden performance attributes behind a creative id. Injected
   *  rather than imported so the engine stays pure and the calibration script can
   *  substitute deliberately-shaped creatives. */
  resolveCreative: (creativeId: string) => CreativeAttributes;
}

const isLive = (s: { status: string }) => s.status === 'active';

/**
 * How many other live ad sets are pointed at the same people.
 *
 * Grouped by explicit `overlapGroup` when set, falling back to the audience id, so
 * a learner who duplicates an ad set onto the identical audience is counted as
 * competing with themselves, while one who duplicates onto a genuinely new
 * audience is not. That difference is the entire lesson of module 7.2.
 */
function overlapCounts(adSets: SimAdSet[], audiences: Map<string, SimAudience>): Map<string, number> {
  const byGroup = new Map<string, number>();
  for (const a of adSets) {
    const aud = audiences.get(a.audienceId);
    const group = aud?.overlapGroup ?? a.audienceId;
    byGroup.set(group, (byGroup.get(group) ?? 0) + 1);
  }
  const perAdSet = new Map<string, number>();
  for (const a of adSets) {
    const aud = audiences.get(a.audienceId);
    const group = aud?.overlapGroup ?? a.audienceId;
    perAdSet.set(a.id, (byGroup.get(group) ?? 1) - 1);
  }
  return perAdSet;
}

/**
 * Splits an ad set's spend across its live ads.
 *
 * Meta concentrates on the ad that is winning, but far less aggressively than CBO
 * does across ad sets, and it keeps sampling the others. Modelled as a gentle
 * exponent on click-through efficiency with an equal split before any history.
 */
function allocateAcrossAds(spend: number, ads: SimAd[], rng: Rng): Map<string, number> {
  const out = new Map<string, number>();
  if (ads.length === 0 || spend <= 0) return out;

  const scores = ads.map((ad) => {
    const { impressions, clicks } = ad.runtime;
    if (impressions < 500) return 1 * jitter(rng, 0.15);
    return ((clicks / impressions) * 100) ** 1.6;
  });
  const total = scores.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const even = spend / ads.length;
    for (const ad of ads) out.set(ad.id, even);
    return out;
  }
  ads.forEach((ad, i) => out.set(ad.id, spend * (scores[i] / total)));
  return out;
}

function deliveryStateFor(adSet: SimAdSet, liveAdCount: number, spend: number): DeliveryState {
  if (adSet.status === 'paused') return 'paused';
  if (liveAdCount === 0 || spend <= 0) return 'not_delivering';
  return adSet.runtime.learningState;
}

/**
 * Advances the account by one day.
 *
 * Returns a new state rather than mutating the caller's: the simulator persists
 * state per day and replays runs from a seed, so accidental sharing between days
 * would be a genuinely hard bug to find. The clone is cheap at this size.
 */
export function tick(state: SimState, opts: TickOptions): { state: SimState; result: DayResult } {
  const next: SimState = structuredClone(state);
  const day = next.day;
  const weekdayIndex = day % 7;

  const audiences = new Map(next.audiences.map((a) => [a.id, a]));
  const liveAdSets = next.adSets.filter(isLive);
  const overlaps = overlapCounts(liveAdSets, audiences);

  const adSetResults: AdSetDayResult[] = [];
  const account = emptyDayMetrics();

  for (const campaign of next.campaigns) {
    const campaignAdSets = next.adSets.filter((a) => a.campaignId === campaign.id);
    const campaignLive = campaignAdSets.filter(isLive);

    // A paused campaign delivers nothing, but its ad sets still need day rows so
    // the dashboard can show a real zero rather than a gap in the series.
    const budgets = isLive(campaign)
      ? budgetsForCampaign(campaign, campaignLive, streamFor(opts.seed, day, `cbo:${campaign.id}`))
      : new Map<string, number>();

    // Record each ad set's share so tomorrow's allocation can carry the inertia
    // that makes CBO concentrate. Only meaningful under CBO; ABO shares are fixed
    // by the learner and never feed back.
    if (campaign.budgetMode === 'cbo') {
      const allocated = Array.from(budgets.values()).reduce((a, b) => a + b, 0);
      for (const a of campaignLive) {
        a.runtime.cboShare = allocated > 0 ? (budgets.get(a.id) ?? 0) / allocated : 0;
      }
    }

    for (const adSet of campaignAdSets) {
      const audience = audiences.get(adSet.audienceId);
      const ads = next.ads.filter((ad) => ad.adSetId === adSet.id && isLive(ad));
      const rng = streamFor(opts.seed, day, adSet.id);

      // Learning state is read before today's delivery: it reflects what the ad set
      // had accumulated coming into the day, which is what delivery reacts to.
      adSet.runtime.learningState = learningStateFor(adSet, day);
      const penalised = isPenalised(adSet.runtime.learningState);

      const allowed = budgets.get(adSet.id) ?? 0;
      const canDeliver = isLive(campaign) && isLive(adSet) && ads.length > 0 && audience !== undefined && allowed > 0;

      if (!canDeliver || !audience) {
        adSet.runtime.trailingEvents = pushTrailing(adSet.runtime.trailingEvents, 0);
        adSetResults.push({
          ...emptyDayMetrics(),
          adSetId: adSet.id,
          campaignId: campaign.id,
          cpm: 0,
          frequency: adSet.runtime.reach > 0 ? adSet.runtime.impressions / adSet.runtime.reach : 0,
          delivery: deliveryStateFor(adSet, ads.length, 0),
          trailingEvents: trailingEventTotal(adSet.runtime.trailingEvents),
          ads: [],
        });
        continue;
      }

      // Read the shock against yesterday's settled level, before the EMA absorbs
      // today's figure: scaling gently keeps `ratio` under the threshold and costs
      // nothing, while a jump pays for the inventory it forces delivery to buy.
      const shock = budgetShock(allowed, adSet.runtime.budgetEma);
      adSet.runtime.budgetEma = updateBudgetEma(adSet.runtime.budgetEma, allowed);

      const spend = paceSpend(allowed, {
        learningPenalty: penalised,
        costCapped: campaign.bidStrategy === 'cost_cap',
      }, rng);

      const noiseSpread = MODEL.dailyNoise * (penalised ? MODEL.learningNoiseMultiplier : 1);
      const priorReach = adSet.runtime.reach;
      const priorFrequency = priorReach > 0 ? adSet.runtime.impressions / priorReach : 0;

      const adSpends = allocateAcrossAds(spend, ads, rng);
      const adResults: AdDayResult[] = [];
      let adSetImpressions = 0;
      let adSetSpend = 0;

      for (const ad of ads) {
        const adRng = streamFor(opts.seed, day, ad.id);
        const creative = opts.resolveCreative(ad.creativeId);
        const adSpend = adSpends.get(ad.id) ?? 0;
        if (adSpend <= 0) continue;

        const cpm = computeCpm({
          audience,
          creative,
          frequency: priorFrequency,
          overlappingSiblings: overlaps.get(adSet.id) ?? 0,
          learningPenalty: penalised,
          advantagePlacements: adSet.advantagePlacements,
          marketPressure: next.conditions.marketPressure,
          weekdayIndex,
          noiseSpread,
        }, adRng);

        const shockedCpm = cpm * shock.cpm;
        const impressions = Math.max(0, Math.round((adSpend / shockedCpm) * 1000));
        // This creative's own frequency against the pool, which is what fatigues.
        const creativeFrequency = priorReach > 0 ? ad.runtime.impressions / priorReach : 0;

        const linkClicks = computeLinkClicks({
          impressions, audience, creative, creativeFrequency, noiseSpread,
        }, adRng);

        const purchases = computePurchases({
          linkClicks,
          audience,
          // The shock reaches people further from the converting core, so it lands
          // on conversion rate as well as on price.
          landingPageQuality: next.conditions.landingPageQuality * shock.cvr,
          learningPenalty: penalised,
          noiseSpread,
        }, adRng);

        const revenue = Math.round(purchases * next.conditions.aov * jitter(adRng, 0.12));

        ad.runtime.impressions += impressions;
        ad.runtime.clicks += linkClicks;
        ad.runtime.spend += Math.round(adSpend);
        ad.runtime.purchases += purchases;
        ad.runtime.revenue += revenue;

        adResults.push({
          adId: ad.id,
          spend: Math.round(adSpend), impressions, linkClicks, purchases, revenue,
          reach: 0, // reach is a property of the audience, tracked at ad set level
          creativeFrequency,
        });
        adSetImpressions += impressions;
        adSetSpend += adSpend;
      }

      const gainedReach = Math.round(newReach(adSetImpressions, audience.size, priorReach));
      const totals = adResults.reduce(
        (acc, r) => ({
          linkClicks: acc.linkClicks + r.linkClicks,
          purchases: acc.purchases + r.purchases,
          revenue: acc.revenue + r.revenue,
        }),
        { linkClicks: 0, purchases: 0, revenue: 0 },
      );

      adSet.runtime.impressions += adSetImpressions;
      adSet.runtime.clicks += totals.linkClicks;
      adSet.runtime.spend += Math.round(adSetSpend);
      adSet.runtime.purchases += totals.purchases;
      adSet.runtime.revenue += totals.revenue;
      adSet.runtime.reach += gainedReach;
      adSet.runtime.trailingEvents = pushTrailing(
        adSet.runtime.trailingEvents,
        optimisationEvents(totals.purchases, adSet),
      );
      // Re-read after today's events: an ad set that just crossed the threshold
      // should report `active` in today's row, not next tick.
      adSet.runtime.learningState = learningStateFor(adSet, day);

      const cpm = adSetImpressions > 0 ? (adSetSpend / adSetImpressions) * 1000 : 0;
      adSetResults.push({
        adSetId: adSet.id,
        campaignId: campaign.id,
        spend: Math.round(adSetSpend),
        impressions: adSetImpressions,
        linkClicks: totals.linkClicks,
        purchases: totals.purchases,
        revenue: totals.revenue,
        reach: gainedReach,
        cpm,
        frequency: adSet.runtime.reach > 0 ? adSet.runtime.impressions / adSet.runtime.reach : 0,
        delivery: deliveryStateFor(adSet, ads.length, adSetSpend),
        trailingEvents: trailingEventTotal(adSet.runtime.trailingEvents),
        ads: adResults,
      });

      account.spend += Math.round(adSetSpend);
      account.impressions += adSetImpressions;
      account.linkClicks += totals.linkClicks;
      account.purchases += totals.purchases;
      account.revenue += totals.revenue;
      account.reach += gainedReach;
    }
  }

  next.day = day + 1;
  return { state: next, result: { day, adSets: adSetResults, account } };
}

/** Runs `days` consecutive ticks, returning the final state and every day's result. */
export function run(state: SimState, days: number, opts: TickOptions): { state: SimState; results: DayResult[] } {
  let cur = state;
  const results: DayResult[] = [];
  for (let i = 0; i < days; i++) {
    const step = tick(cur, opts);
    cur = step.state;
    results.push(step.result);
  }
  return { state: cur, results };
}
