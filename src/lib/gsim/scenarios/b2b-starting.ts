/**
 * Ledgerline's Google Ads account, as the founder set it up.
 *
 * Deliberately not the shoe account with different words in it. The mistakes a B2B
 * account makes are its own, and a learner who carries their D2C instincts across
 * unchanged will get several things exactly backwards:
 *
 *   - **The waste looks like intent.** "Accounting course online", "tally course
 *     fees", "accountant salary in india" — students and job-seekers, in volume,
 *     reading as commercial searches. In the shoe account the waste announced
 *     itself ("repair", "jobs", "free"). Here half of it is the product category
 *     spelled correctly.
 *
 *   - **"Free" is the most expensive word in the account.** Nine hundred searches a
 *     day for free accounting software, none of which will ever buy anything, all
 *     of which look like people shopping for accounting software.
 *
 *   - **Competitor terms are the best inventory, not the worst.** Somebody typing
 *     "tally alternative" has already decided to leave Tally. The D2C reflex is to
 *     negate competitor names; doing it here removes the strongest non-brand
 *     keyword in the account.
 *
 *   - **Brand is not automatically good.** The brand campaign is winning "ledgerline
 *     login" — a hundred and forty searches a day from existing customers, paid
 *     for, going to a page they would have reached anyway.
 *
 * The account is also *profitable on paper*, which is the trap. A demo is credited
 * at ₹19,800 of pipeline value, so a handful of them covers a lot of waste, and
 * nothing in the interface distinguishes a demo that closes from one that does not.
 */

import { accountFor, ad, adGroup, campaign, keyword } from '../state';
import type { GState } from '../engine/types';

export function buildB2BStartingAccount(): GState {
  const state = accountFor('b2b');

  state.campaigns = [
    campaign({ id: 'c-brand', name: 'Brand', dailyBudget: 900, bidStrategy: 'manual_cpc' }),
    campaign({ id: 'c-generic', name: 'Search — Software', dailyBudget: 6500, bidStrategy: 'manual_cpc' }),
  ];

  state.adGroups = [
    adGroup({
      id: 'g-brand', campaignId: 'c-brand', name: 'Ledgerline',
      defaultCpc: 60, landingPageQuality: 1.15,
    }),
    adGroup({
      id: 'g-software', campaignId: 'c-generic', name: 'Accounting software',
      defaultCpc: 240,
      // One product page for a market that searches in half a dozen different
      // vocabularies: GST, billing, invoicing, inventory, ERP.
      landingPageQuality: 0.78,
    }),
  ];

  state.keywords = [
    // Brand, broad, which is how "ledgerline login" gets bought.
    keyword({ id: 'k-brand', adGroupId: 'g-brand', text: 'ledgerline', match: 'broad', maxCpc: 60 }),

    keyword({ id: 'k-accounting-sw', adGroupId: 'g-software', text: 'accounting software', match: 'broad', maxCpc: 260 }),
    keyword({ id: 'k-gst', adGroupId: 'g-software', text: 'gst software', match: 'broad', maxCpc: 240 }),
    keyword({ id: 'k-billing', adGroupId: 'g-software', text: 'billing software', match: 'broad', maxCpc: 220 }),
    keyword({ id: 'k-small-biz', adGroupId: 'g-software', text: 'accounting software for small business', match: 'phrase', maxCpc: 320 }),
  ];

  state.ads = [
    ad({
      id: 'a-brand', adGroupId: 'g-brand', finalUrl: '/',
      headlines: ['Ledgerline — Cloud Accounting', 'Ledgerline Official Site', 'Book A 20-Minute Demo'],
      descriptions: ['Cloud accounting and GST filing for growing Indian businesses. Book a demo.'],
    }),
    ad({
      id: 'a-software', adGroupId: 'g-software', finalUrl: '/product',
      headlines: [
        'Cloud Accounting Software',
        'GST Filing Built In',
        'Trusted By 4,000 Businesses',
      ],
      descriptions: [
        'Accounting, invoicing and GST returns in one place. Book a 20-minute demo.',
      ],
    }),
  ];

  state.negatives = [];

  return state;
}
