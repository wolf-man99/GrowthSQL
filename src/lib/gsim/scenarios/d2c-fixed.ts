/**
 * NORTHBOUND's account after somebody who knows what they are doing has been at it.
 *
 * This exists to be measured against `buildD2CStartingAccount()`. Every mission's
 * grading, every debrief's claim and half the calibration gate rest on one
 * proposition: that the things the course teaches actually work in the model. That
 * proposition is only checkable if there is a version of the account with those
 * things done to it, run on the same seed against the same market.
 *
 * Nothing here is exotic. It is the same budget, the same product and the same
 * queries. What changed is only what the curriculum says to change:
 *
 *   1. **Brand is its own campaign**, on a small budget it cannot exceed, so its
 *      excellent numbers stop flattering everything else and stop competing with
 *      non-brand for the same rupees.
 *   2. **Ad groups hold one theme each**, so an ad can actually contain its own
 *      keywords and Quality Score has somewhere to go.
 *   3. **Match types are tightened** to phrase and exact, so the account stops
 *      paying to discover queries it already knows it does not want.
 *   4. **Negatives fence off the waste** the search terms report exposed: repairs,
 *      jobs, free, second-hand, competitors, research and other people's products.
 *   5. **Bids follow value** — more on the terms that convert, less on the ones
 *      that only look like they do.
 *
 * If running this does not comfortably beat the starting account, the model is
 * wrong and the course is teaching things that are not true. The gate asserts it.
 */

import { accountFor, ad, adGroup, campaign, keyword, negative } from '../state';
import type { GState } from '../engine/types';

export function buildD2CFixedAccount(): GState {
  const state = accountFor('d2c');

  state.campaigns = [
    // Brand: capped deliberately low. There are only about five hundred brand
    // searches a day in this market and no amount of budget invents more, so
    // anything above what it takes to hold them is money that cannot be spent.
    campaign({ id: 'c-brand', name: 'Brand', dailyBudget: 600, bidStrategy: 'manual_cpc' }),
    campaign({ id: 'c-nonbrand', name: 'Search — Non-brand', dailyBudget: 2900, bidStrategy: 'manual_cpc' }),
  ];

  state.adGroups = [
    adGroup({ id: 'g-brand', campaignId: 'c-brand', name: 'NORTHBOUND', defaultCpc: 26, landingPageQuality: 1.2 }),
    adGroup({ id: 'g-trail', campaignId: 'c-nonbrand', name: 'Trail running shoes', defaultCpc: 62, landingPageQuality: 1.15 }),
    adGroup({ id: 'g-waterproof', campaignId: 'c-nonbrand', name: 'Waterproof & monsoon', defaultCpc: 68, landingPageQuality: 1.15 }),
    adGroup({ id: 'g-support', campaignId: 'c-nonbrand', name: 'Flat feet & arch support', defaultCpc: 64, landingPageQuality: 1.15 }),
    adGroup({ id: 'g-buy', campaignId: 'c-nonbrand', name: 'Buy running shoes', defaultCpc: 95, landingPageQuality: 1.1 }),
  ];

  state.keywords = [
    keyword({ id: 'f-brand-e', adGroupId: 'g-brand', text: 'northbound', match: 'exact', maxCpc: 26 }),
    keyword({ id: 'f-brand-p', adGroupId: 'g-brand', text: 'northbound shoes', match: 'phrase', maxCpc: 30 }),

    keyword({ id: 'f-trail-p', adGroupId: 'g-trail', text: 'trail running shoes', match: 'phrase', maxCpc: 62 }),
    keyword({ id: 'f-trail-e', adGroupId: 'g-trail', text: 'buy trail running shoes', match: 'exact', maxCpc: 88 }),

    keyword({ id: 'f-water-p', adGroupId: 'g-waterproof', text: 'waterproof running shoes', match: 'phrase', maxCpc: 76 }),
    keyword({ id: 'f-monsoon-p', adGroupId: 'g-waterproof', text: 'running shoes for monsoon', match: 'phrase', maxCpc: 68 }),

    keyword({ id: 'f-flat-p', adGroupId: 'g-support', text: 'running shoes for flat feet', match: 'phrase', maxCpc: 70 }),
    keyword({ id: 'f-arch-p', adGroupId: 'g-support', text: 'running shoes with arch support', match: 'phrase', maxCpc: 64 }),

    keyword({ id: 'f-buy-p', adGroupId: 'g-buy', text: 'buy running shoes online', match: 'phrase', maxCpc: 98 }),
    keyword({ id: 'f-buy-e', adGroupId: 'g-buy', text: 'buy running shoes online', match: 'exact', maxCpc: 105 }),
  ];

  state.ads = [
    // Each ad carries its own ad group's keywords, which is the whole reason for
    // splitting them up. One ad cannot say "trail" and "waterproof" and "flat feet"
    // and "buy now" and mean any of them.
    ad({
      id: 'f-ad-brand', adGroupId: 'g-brand', finalUrl: '/',
      headlines: ['NORTHBOUND Official Store', 'NORTHBOUND Shoes — Direct', 'Free Shipping & 30-Day Returns'],
      descriptions: ['The official NORTHBOUND store. Every model, every size, shipped free across India.'],
    }),
    ad({
      id: 'f-ad-trail', adGroupId: 'g-trail', finalUrl: '/trail',
      headlines: ['Trail Running Shoes', 'Grip Built For Indian Trails', 'Trail Shoes From ₹3,499'],
      descriptions: ['Trail running shoes tested on wet rock and loose gravel. Free shipping, 30-day returns.'],
    }),
    ad({
      id: 'f-ad-water', adGroupId: 'g-waterproof', finalUrl: '/waterproof',
      headlines: ['Waterproof Running Shoes', 'Running Shoes For Monsoon', 'Stay Dry, Keep Running'],
      descriptions: ['Waterproof running shoes built for monsoon roads. Sealed uppers, fast-draining soles.'],
    }),
    ad({
      id: 'f-ad-support', adGroupId: 'g-support', finalUrl: '/support',
      headlines: ['Running Shoes For Flat Feet', 'Arch Support Running Shoes', 'Fitted For Overpronation'],
      descriptions: ['Running shoes with structured arch support, built for flat feet and overpronation.'],
    }),
    ad({
      id: 'f-ad-buy', adGroupId: 'g-buy', finalUrl: '/shop',
      headlines: ['Buy Running Shoes Online', 'Running Shoes — Free Shipping', 'Order Today, Ships Tomorrow'],
      descriptions: ['Buy running shoes online direct from NORTHBOUND. Free shipping and 30-day returns.'],
    }),
  ];

  // The list a search terms report produces after two weeks of broad match. Every
  // one of these is a real term the starting account paid for and got nothing from.
  state.negatives = [
    ...[
      'repair', 'free', 'second hand', 'used', 'wholesale', 'rent', 'jobs',
      'salary', 'how to', 'wikipedia', 'history', 'size guide', 'clean',
      'replace', 'school shoes', 'formal', 'football', 'crack', 'course',
    ].map((text, i) => negative({ id: `n-w${i}`, level: 'account', text, match: 'phrase' })),

    // Competitors, negated as a decision rather than an accident. Bidding on them
    // is defensible; doing it by mistake through broad match is not.
    ...['nike', 'adidas', 'decathlon', 'asics'].map((text, i) =>
      negative({ id: `n-x${i}`, level: 'account', text, match: 'broad' })),
  ];

  return state;
}
