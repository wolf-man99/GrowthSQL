/**
 * NORTHBOUND's app, being bought the way app installs are usually bought.
 *
 * The same brand as the Search account on purpose. It is the same business, the
 * same ₹4,200 order and the same 46% margin, so a learner who has already worked
 * out that the account can afford ₹1,932 to acquire a customer arrives here
 * already knowing the only number that matters — and can watch a campaign that
 * reports a magnificent ₹24 cost per install quietly spend four times that ceiling
 * on every customer it actually produces.
 *
 * The starting configuration is not a straw man. It is what an app team asks for:
 *
 *   - the goal is **install volume**, because installs are what the weekly deck
 *     counts and what the agency was briefed on;
 *   - there is a **target CPI**, set to a number somebody saw in a case study;
 *   - the assets include images, so the cheap inventory is wide open;
 *   - there is no video, so the one mid-priced channel that would have balanced
 *     things out is not even available.
 *
 * Every one of those is defensible on its own. Together they buy six thousand
 * installs a month from people who will never open the app twice.
 */

import { accountFor, campaign } from '../state';
import type { GState } from '../engine/types';

/** What the app is worth per user who does the thing, and how many of them do it. */
export const NORTHBOUND_APP = {
  eventName: 'First purchase',
  /** Share of installs making a first purchase at baseline channel quality. */
  eventRate: 0.055,
  /** The order itself, matching the Search account's average. */
  eventValue: 4200,
  /** Gross profit on that order, and therefore the most a customer may cost. */
  ceiling: 4200 * 0.46,
};

export function buildAppStartingAccount(): GState {
  const state = accountFor('d2c');

  state.campaigns = [
    campaign({
      id: 'c-app',
      name: 'App — Installs',
      type: 'app',
      dailyBudget: 8000,
    }),
  ];

  state.campaigns[0].app = {
    goal: 'installs',
    // A number from somebody else's case study, in somebody else's market, for
    // somebody else's app. It is met easily, which is the trouble with it.
    targetCpi: 40,
    assets: { headlines: 5, descriptions: 4, images: 10, videos: 0 },
    eventName: NORTHBOUND_APP.eventName,
    eventRate: NORTHBOUND_APP.eventRate,
    eventValue: NORTHBOUND_APP.eventValue,
  };

  return state;
}

/**
 * The same app, bought against the thing the business actually sells.
 *
 * Three changes, and only three. The goal moves from installs to the first
 * purchase; the target moves with it, set to what the margin can bear rather than
 * to a number from a slide; and a handful of videos are added, which is what opens
 * YouTube and gives the campaign somewhere to go between the cheap inventory and
 * the dear inventory.
 *
 * The reported cost per install gets much worse. That is the point, and it is why
 * this is hard to do in a real company: the metric on the weekly deck moves the
 * wrong way for a quarter while the business gets better underneath it.
 */
export function buildAppFixedAccount(): GState {
  const state = buildAppStartingAccount();
  const c = state.campaigns[0];
  c.name = 'App — First purchase';
  c.app = {
    goal: 'in_app_action',
    targetEventCpa: Math.round(NORTHBOUND_APP.ceiling * 0.9),
    assets: { headlines: 8, descriptions: 5, images: 10, videos: 4 },
    eventName: NORTHBOUND_APP.eventName,
    eventRate: NORTHBOUND_APP.eventRate,
    eventValue: NORTHBOUND_APP.eventValue,
  };
  return state;
}
