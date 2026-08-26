/**
 * NORTHBOUND's Google Ads account, as somebody else left it.
 *
 * The starting point for the D2C sandbox and for most of the missions. It is
 * deliberately a *plausible* account rather than a broken one: everything in it is
 * something a competent person might have done, and every problem in it is one
 * that only shows up when you read the search terms report.
 *
 * What is wrong with it, in the order a learner tends to find it:
 *
 *   1. One ad group holds four unrelated themes, so no ad can be relevant to all
 *      of them and Quality Score suffers across the board.
 *   2. Everything is broad match with no negatives, so the account is paying for
 *      repairs, jobs, free shoes and competitor research.
 *   3. The brand keyword sits in the same campaign as everything else, so brand's
 *      excellent numbers are averaged into generic's terrible ones and the account
 *      looks fine.
 *   4. The budget is capped well below what the good keywords could spend, so the
 *      waste is not just wasted — it is crowding out the traffic that works.
 *
 * None of that is narrated in the interface. It is all visible in the reports, if
 * you look, which is the entire skill.
 */

import { accountFor, ad, adGroup, campaign, keyword } from '../state';
import type { GState } from '../engine/types';

export function buildD2CStartingAccount(): GState {
  const state = accountFor('d2c');

  state.campaigns = [
    campaign({
      id: 'c-search',
      name: 'Search — All Products',
      type: 'search',
      dailyBudget: 3500,
      bidStrategy: 'manual_cpc',
    }),
  ];

  state.adGroups = [
    adGroup({
      id: 'g-everything',
      campaignId: 'c-search',
      name: 'Shoes',
      defaultCpc: 50,
      // One landing page for four themes. This is the ceiling on the whole
      // account's Quality Score and it cannot be bid past.
      landingPageQuality: 0.72,
    }),
  ];

  state.keywords = [
    // Broad, wide, and hungry. Every one of these is a reasonable thing to want
    // to appear for; together and unfenced they are a bonfire.
    keyword({ id: 'k-running-shoes', adGroupId: 'g-everything', text: 'running shoes', match: 'broad', maxCpc: 55 }),
    keyword({ id: 'k-shoes-online', adGroupId: 'g-everything', text: 'shoes online', match: 'broad', maxCpc: 48 }),
    keyword({ id: 'k-trail-shoes', adGroupId: 'g-everything', text: 'trail running shoes', match: 'broad', maxCpc: 58 }),
    keyword({ id: 'k-sneakers', adGroupId: 'g-everything', text: 'sneakers', match: 'broad', maxCpc: 45 }),
    keyword({ id: 'k-buy-shoes', adGroupId: 'g-everything', text: 'buy running shoes online', match: 'phrase', maxCpc: 70 }),
    // Brand, buried in the same ad group as everything else, where its
    // extraordinary numbers quietly subsidise the rest.
    keyword({ id: 'k-brand', adGroupId: 'g-everything', text: 'northbound', match: 'broad', maxCpc: 30 }),
  ];

  state.ads = [
    ad({
      id: 'a-generic',
      adGroupId: 'g-everything',
      headlines: [
        'NORTHBOUND Shoes Online',
        'Free Shipping Across India',
        'Shop The New Season',
      ],
      descriptions: [
        'Premium footwear built for Indian roads and Indian weather. 30-day returns.',
      ],
      finalUrl: '/shop',
    }),
  ];

  state.negatives = [];

  return state;
}
