/**
 * App campaigns: the third simulator, and the one that is barely an auction.
 *
 * A Search campaign is bought one question at a time. An App campaign is not
 * bought at all in that sense — there are no keywords, no ad groups, no placements
 * to choose and no bids to place per anything. You hand Google a set of assets and
 * a goal, and it decides where to run them across Search, Play, YouTube, Display
 * and Discover. That is not a simplification of the interface; it is the product.
 *
 * Which means the levers a learner has are genuinely different, and there are only
 * three of them:
 *
 *   1. **The goal.** Installs, an in-app action, or return on ad spend. This is the
 *      whole campaign. Ask for installs and you get installs — cheap ones, from
 *      people who open the app once. Ask for the action and you get a fraction as
 *      many installs at several times the price, from people who stay.
 *   2. **The assets.** Not their quality so much as their *shape*: no video means
 *      no YouTube inventory, no images means no Display or Discover. Assets are how
 *      much of the internet the campaign is allowed to run on.
 *   3. **The budget and the target.** A target so aggressive it cannot be met does
 *      not produce a miracle; it produces a campaign that stops delivering.
 *
 * The lesson this exists to make felt is the first one. Cost per install is the
 * metric every app team reports and the one that means least: the cheapest installs
 * in this model come from the channels whose users are least likely to ever open
 * the app again, and a campaign optimised to that number will confidently buy them
 * by the thousand.
 */

import {
  GMODEL, G_WEEKDAY_WEIGHT, emptyDayMetrics,
  type AppChannelId, type AppDayResult, type AppChannelRow, type GCampaign,
} from './types';
import { jitter, streamFor, type Rng } from './rng';

/**
 * The inventory an App campaign can run on.
 *
 * Ordered roughly cheap-to-dear by install, which is also roughly worst-to-best by
 * what those installs then do. That inverse relationship is not a flourish — it is
 * the reason the module exists, and every number below is set to hold it.
 *
 * `retention` is how likely this channel's installs are to go on to perform the
 * in-app action the business actually cares about, relative to a baseline of 1.
 * Display and Discover are full of accidental installs — a mis-tap inside another
 * app, an interstitial dismissed the wrong way — while Search is somebody who
 * typed the app's category into Google and meant it. A twenty-fold spread sounds
 * extreme and is, if anything, conservative.
 */
export interface AppChannel {
  id: AppChannelId;
  label: string;
  /** Cost per thousand impressions, before market pressure and weekday. */
  cpm: number;
  /** Share of impressions that become clicks. */
  ctr: number;
  /** Share of clicks that reach the store and complete an install. */
  installRate: number;
  /** How much better or worse this channel's installs are at doing the thing. */
  retention: number;
  /** Daily impressions available to one advertiser, before budget. */
  supply: number;
  /** What an ad needs before it may run here at all. */
  requires: 'text' | 'image' | 'video';
}

export const APP_CHANNELS: AppChannel[] = [
  // Read the pairs, not the numbers. An install off Google Search costs eight
  // times what one off the Display Network costs, and is twenty times likelier to
  // become a paying customer. Every figure below exists to hold that inversion,
  // because it is the only thing this module is really for.
  //
  // The CPMs look wild next to each other and should: a 5.2% click-through on
  // Search means a ₹2,246 CPM is a ₹43 click, while a 0.6% click-through on Display
  // means a ₹8 CPM is a ₹1.36 one. Both are ordinary Indian prices.
  {
    id: 'search', label: 'Google Search', cpm: 2246, ctr: 0.052, installRate: 0.24,
    retention: 3.4, supply: 42_000, requires: 'text',
  },
  {
    id: 'play', label: 'Google Play', cpm: 1525, ctr: 0.041, installRate: 0.31,
    retention: 2.4, supply: 74_000, requires: 'text',
  },
  {
    id: 'youtube', label: 'YouTube', cpm: 116, ctr: 0.014, installRate: 0.11,
    retention: 1.0, supply: 240_000, requires: 'video',
  },
  {
    id: 'discover', label: 'Discover', cpm: 34, ctr: 0.009, installRate: 0.085,
    retention: 0.42, supply: 1_200_000, requires: 'image',
  },
  {
    id: 'display', label: 'Display Network', cpm: 8.2, ctr: 0.006, installRate: 0.062,
    retention: 0.16, supply: 6_000_000, requires: 'image',
  },
];

export const APP_CHANNEL_BY_ID = new Map(APP_CHANNELS.map((c) => [c.id, c]));

/** What the campaign has been given to run with. Counts, not files: what matters
 *  to delivery is whether a *kind* of asset exists, and how much variety there is
 *  within it for the system to rotate between. */
export interface AppAssets {
  headlines: number;
  descriptions: number;
  images: number;
  videos: number;
}

export type AppBidGoal = 'installs' | 'in_app_action' | 'roas';

export const APP_GOAL_LABEL: Record<AppBidGoal, string> = {
  installs: 'Install volume',
  in_app_action: 'In-app action',
  roas: 'Return on ad spend',
};

/** The App-specific half of a campaign. */
export interface AppSettings {
  goal: AppBidGoal;
  assets: AppAssets;
  /** Target cost per install, when the goal is installs. */
  targetCpi?: number;
  /** Target cost per in-app action, when the goal is that action. */
  targetEventCpa?: number;
  targetRoas?: number;
  /** What the in-app action is called: 'Registration', 'First purchase'. */
  eventName: string;
  /** Share of installs that perform the action at baseline retention, 0..1. */
  eventRate: number;
  /** What one in-app action is worth, in rupees. */
  eventValue: number;
}

/** Whether a channel's asset requirement is met, and by how much variety. */
function assetCoverage(assets: AppAssets, requires: AppChannel['requires']): number {
  const text = Math.min(1, assets.headlines / 5) * 0.6 + Math.min(1, assets.descriptions / 5) * 0.4;
  if (requires === 'text') return text;
  // Image and video inventory needs the text too — every format carries copy.
  if (requires === 'image') {
    return assets.images === 0 ? 0 : text * (0.55 + Math.min(1, assets.images / 8) * 0.45);
  }
  return assets.videos === 0 ? 0 : text * (0.5 + Math.min(1, assets.videos / 4) * 0.5);
}

/**
 * How much this campaign wants each channel, given what it is optimising for.
 *
 * The heart of the module. The goal does not change the channels; it changes which
 * of them the money flows to, and the channels differ in exactly the way that makes
 * the choice consequential.
 *
 *   - **installs** ranks by predicted cost per install, and nothing else. Display
 *     is four times cheaper per install than Search, so Display wins, and the
 *     campaign fills up with people who tapped an ad by accident.
 *   - **in_app_action** ranks by predicted cost per *action*, which prices the
 *     retention difference in. Search and Play win. Installs collapse, the reported
 *     cost per install triples, and the business does better.
 *   - **roas** does the same but weighted by what an action is worth, which for a
 *     single event value comes to the same ordering — included because the third
 *     option exists and a learner should see it behave sanely rather than be told
 *     it is out of scope.
 */
function channelAppetite(channel: AppChannel, app: AppSettings): number {
  const costPerInstall = channel.cpm / 1000 / (channel.ctr * channel.installRate);

  switch (app.goal) {
    case 'installs':
      return 1 / costPerInstall;
    case 'in_app_action': {
      const costPerAction = costPerInstall / (app.eventRate * channel.retention);
      return 1 / costPerAction;
    }
    case 'roas': {
      const costPerAction = costPerInstall / (app.eventRate * channel.retention);
      return app.eventValue / costPerAction;
    }
  }
}

/** Whether the target the campaign has been given is achievable on this channel.
 *  A target that cannot be met is not aspirational, it is a filter. */
function meetsTarget(channel: AppChannel, app: AppSettings): boolean {
  const costPerInstall = channel.cpm / 1000 / (channel.ctr * channel.installRate);
  const costPerAction = costPerInstall / (app.eventRate * channel.retention);

  if (app.goal === 'installs' && app.targetCpi) return costPerInstall <= app.targetCpi * 1.35;
  if (app.goal === 'in_app_action' && app.targetEventCpa) {
    return costPerAction <= app.targetEventCpa * 1.35;
  }
  if (app.goal === 'roas' && app.targetRoas) {
    return app.eventValue / costPerAction >= app.targetRoas * 0.72;
  }
  return true;
}

export interface AppTickInputs {
  campaign: GCampaign;
  app: AppSettings;
  marketPressure: number;
  day: number;
  seed: number;
}

/**
 * One day of an App campaign.
 *
 * Not an auction loop. There is no per-search decision to make and no keyword to
 * attribute anything to, so modelling it that way would add machinery that carries
 * no lesson. What it is instead is an allocation: the budget lands across the
 * channels the assets unlock, weighted by what the goal asks for, and each channel
 * converts money into impressions, clicks, installs and — much later, and much
 * less predictably — the thing the business wanted.
 */
export function tickApp(i: AppTickInputs): AppDayResult {
  const { campaign, app } = i;
  const rng = streamFor(i.seed, i.day, `app:${campaign.id}`);
  const weekday = G_WEEKDAY_WEIGHT[i.day % 7];

  const eligible = APP_CHANNELS
    .map((channel) => ({
      channel,
      coverage: assetCoverage(app.assets, channel.requires),
      allowed: meetsTarget(channel, app),
    }))
    .filter((e) => e.coverage > 0 && e.allowed);

  const rows: AppChannelRow[] = [];
  const totals = { ...emptyDayMetrics(), installs: 0, events: 0 };

  if (eligible.length === 0) {
    return {
      campaignId: campaign.id, ...totals, channels: [],
      budget: campaign.dailyBudget, budgetCapped: false,
      blocked: blockedReason(app),
    };
  }

  // Appetite decides the split. Coverage scales it, because a channel the campaign
  // is barely equipped for is one it can only partly use.
  const weights = eligible.map((e) => channelAppetite(e.channel, app) * e.coverage);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  let spent = 0;
  for (let n = 0; n < eligible.length; n++) {
    const { channel, coverage } = eligible[n];
    const share = weights[n] / weightSum;
    const wanted = campaign.dailyBudget * share;

    const cpm = channel.cpm * i.marketPressure * jitter(rng, 0.14);
    // Supply is finite: a channel cannot absorb an unlimited budget, which is why
    // an App campaign scaled hard ends up on inventory it would not have chosen.
    const supplyCap = (channel.supply * weekday * coverage * jitter(rng, 0.1)) / 1000 * cpm;
    const cost = Math.min(wanted, supplyCap);

    const impressions = Math.round((cost / cpm) * 1000);
    const clicks = drawCount(impressions * channel.ctr * coverage * jitter(rng, 0.12), rng);
    const installs = drawCount(clicks * channel.installRate * jitter(rng, 0.12), rng);
    // The event happens days after the install in reality. Modelled same-day
    // because a learner advancing a day at a time cannot hold a lag in their head
    // and still see the relationship — and the relationship is the lesson.
    const events = drawCount(
      installs * app.eventRate * channel.retention * jitter(rng, 0.2), rng,
    );

    spent += cost;
    rows.push({
      channelId: channel.id,
      label: channel.label,
      impressions, clicks, cost,
      conversions: events,
      convValue: events * app.eventValue,
      installs,
      events,
    });

    totals.impressions += impressions;
    totals.clicks += clicks;
    totals.cost += cost;
    totals.installs += installs;
    totals.events += events;
    totals.conversions += events;
    totals.convValue += events * app.eventValue;
  }

  return {
    campaignId: campaign.id,
    ...totals,
    channels: rows,
    budget: campaign.dailyBudget,
    // Supply-limited rather than budget-limited is a real and confusing state for
    // an app buyer: the money is available and Google will not take it.
    budgetCapped: spent >= campaign.dailyBudget * 0.98,
  };
}

/** Why nothing ran, when nothing ran. Worth saying plainly: an App campaign that
 *  delivers zero is nearly always one of these two things, and the interface does
 *  not go out of its way to tell you which. */
function blockedReason(app: AppSettings): string {
  const anyCovered = APP_CHANNELS.some((c) => assetCoverage(app.assets, c.requires) > 0);
  if (!anyCovered) return 'No eligible inventory: the campaign has no usable text assets.';
  return 'No eligible inventory: the target is below what any channel can deliver.';
}

/** Turns a fractional expectation into a whole count, keeping the fraction as a
 *  probability so small numbers do not silently round to nothing. */
function drawCount(expected: number, rng: Rng): number {
  if (expected <= 0) return 0;
  const whole = Math.floor(expected);
  return whole + (rng() < expected - whole ? 1 : 0);
}

/** Cost per install, the number every app team reports and the one this module
 *  exists to complicate. Exported because the debriefs need to say it out loud. */
export function costPerInstall(row: { cost: number; installs: number }): number {
  return row.installs > 0 ? row.cost / row.installs : Infinity;
}

/** Cost per in-app action: the same money divided by the thing that mattered. */
export function costPerEvent(row: { cost: number; events: number }): number {
  return row.events > 0 ? row.cost / row.events : Infinity;
}

/** Share of installs that went on to do the thing. The single number that
 *  separates a good App campaign from a cheap one. */
export function activationRate(row: { installs: number; events: number }): number {
  return row.installs > 0 ? row.events / row.installs : 0;
}

export { GMODEL };
