/**
 * The sandbox starting account.
 *
 * Mirrors the NORTHBOUND account a learner already met in the marketing preview
 * and the frozen case study, so opening Run for the first time feels like sitting
 * down at an account they recognise rather than a blank screen. From there it is
 * live: every campaign below is theirs to scale, pause, break, or rescue.
 *
 * The structure is deliberately imperfect, and the specific flaws are verified in
 * scripts/validate-simulator.ts rather than merely asserted here:
 *
 *   - `as-video` is funded at ₹400/day, far too little to reach 50 events a week,
 *     so it sits in Learning Limited until someone consolidates it (module 4.2).
 *   - `aud-cart` is small enough to saturate hard, passing 5x frequency inside six
 *     weeks, so the account's best-converting audience quietly wears out (6.1).
 *   - both CBO campaigns concentrate on an arbitrary early front-runner, leaving
 *     the sibling ad set effectively untested (4.1).
 *   - left completely alone for six weeks, account ROAS decays from roughly 3.0x
 *     to 2.7x, so doing nothing is visibly the wrong move.
 *
 * Note what is deliberately *not* claimed: the prospecting ad sets do not burn out
 * their creative. At this account's realistic scale, six weeks of spend against a
 * 380k pool reaches roughly 1.5x frequency, which is the fatigue onset rather than
 * past it, and forcing a burn would need an implausibly small audience or an
 * implausibly large budget. Creative fatigue shows up here through the small
 * retargeting pool, and is taught properly by the dedicated creative mission.
 */

import {
  ad, adSet, audience, campaign, state, DEFAULT_CONDITIONS,
} from '../factory';
import type { SimState } from '../engine/types';

export function buildSandboxAccount(): SimState {
  return state({
    conditions: { ...DEFAULT_CONDITIONS, aov: 900 },

    audiences: [
      audience('aud-broad-young', 'Advantage+ audience · 18–34', 4_200_000, 0.05, {
        spec: { ageMin: 18, ageMax: 34, genders: 'all', geos: ['IN'], interests: [] },
      }),
      audience('aud-broad-older', 'Advantage+ audience · 35–54', 3_100_000, 0.05, {
        spec: { ageMin: 35, ageMax: 54, genders: 'all', geos: ['IN'], interests: [] },
      }),
      // A genuinely tight interest stack, not a broad category. Narrow enough that
      // sustained spend against it saturates within weeks, which is what makes the
      // fatiguing offer creative sitting on it a lesson rather than a decoration.
      audience('aud-interest', 'Streetwear & sneakerhead interests', 380_000, 0.12, {
        spec: { ageMin: 18, ageMax: 34, genders: 'all', geos: ['IN'], interests: ['Streetwear', 'Sneakers', 'Hypebeast'] },
      }),
      audience('aud-lookalike', 'Fashion lookalike 3%', 640_000, 0.25, {
        type: 'lookalike',
        // Shares a seed with the purchaser file the retargeting pools derive from,
        // so pointing several ad sets at both is genuine self-competition.
        overlapGroup: 'purchasers',
      }),
      audience('aud-cart', 'Cart abandoners · 7 day', 18_400, 0.95, {
        type: 'custom', overlapGroup: 'purchasers',
      }),
      audience('aud-ig', 'IG engagers · 30 day', 92_000, 0.6, { type: 'custom' }),
      audience('aud-video', 'Video viewers 75%+ · 30 day', 34_500, 0.5, { type: 'custom' }),
      audience('aud-dpa-warm', 'Viewed or added to cart', 61_200, 0.7, {
        type: 'dynamic', overlapGroup: 'purchasers',
      }),
      audience('aud-dpa-broad', 'Broad catalog audience', 410_000, 0.2, { type: 'dynamic' }),
    ],

    campaigns: [
      campaign('cmp-advantage', 'Prospecting · Advantage+ Broad', {
        objective: 'sales', budgetMode: 'cbo', dailyBudget: 4_000,
        bidStrategy: 'highest_volume', strategyTag: 'prospecting',
      }),
      campaign('cmp-interest', 'Prospecting · Interest Stack', {
        objective: 'sales', budgetMode: 'abo',
        bidStrategy: 'highest_volume', strategyTag: 'prospecting',
      }),
      campaign('cmp-retarget', 'Retargeting · Warm audiences', {
        objective: 'sales', budgetMode: 'abo',
        bidStrategy: 'cost_cap', costCap: 850, strategyTag: 'retargeting',
      }),
      campaign('cmp-catalog', 'Catalog Sales · DPA', {
        objective: 'sales', budgetMode: 'cbo', dailyBudget: 2_000,
        bidStrategy: 'highest_volume', strategyTag: 'catalog',
      }),
    ],

    adSets: [
      adSet('as-adv-young', 'cmp-advantage', 'Advantage+ · 18–34', 'aud-broad-young'),
      adSet('as-adv-older', 'cmp-advantage', 'Advantage+ · 35–54', 'aud-broad-older'),

      adSet('as-interest', 'cmp-interest', 'Streetwear interests', 'aud-interest', { dailyBudget: 2_400 }),
      adSet('as-lookalike', 'cmp-interest', 'Fashion lookalike 3%', 'aud-lookalike', { dailyBudget: 900 }),

      adSet('as-cart', 'cmp-retarget', 'Cart abandoners · 7 day', 'aud-cart', { dailyBudget: 1_800 }),
      adSet('as-ig', 'cmp-retarget', 'IG engagers · 30 day', 'aud-ig', { dailyBudget: 900 }),
      // Deliberately under-funded: this one cannot reach 50 events a week and will
      // sit in Learning Limited until the learner notices and consolidates.
      adSet('as-video', 'cmp-retarget', 'Video viewers 75%+', 'aud-video', { dailyBudget: 400 }),

      adSet('as-dpa-warm', 'cmp-catalog', 'Dynamic · viewed or added to cart', 'aud-dpa-warm'),
      adSet('as-dpa-broad', 'cmp-catalog', 'Dynamic · broad catalog', 'aud-dpa-broad'),
    ],

    ads: [
      ad('ad-adv-ugc', 'as-adv-young', 'UGC · street styling', 'cr-ugc-street', { format: 'video' }),
      ad('ad-adv-carousel', 'as-adv-young', 'Carousel · bestsellers', 'cr-carousel-best', { format: 'carousel' }),
      ad('ad-adv-founder', 'as-adv-older', 'Founder story', 'cr-founder', { format: 'video' }),

      // The trap: a hard-sell offer creative carrying a whole ad set. It will
      // out-perform everything for about a week and then fall off a cliff.
      ad('ad-int-offer', 'as-interest', 'Offer · 20% off', 'cr-offer-slab', { format: 'image' }),
      ad('ad-int-switch', 'as-interest', 'UGC · why I switched', 'cr-ugc-switch', { format: 'video' }),
      ad('ad-lal-lookbook', 'as-lookalike', 'Static · lookbook grid', 'cr-lookbook', { format: 'image' }),

      ad('ad-cart-nudge', 'as-cart', 'Still thinking it over?', 'cr-retarget-nudge', { format: 'image' }),
      ad('ad-ig-collection', 'as-ig', 'Collection · shop the look', 'cr-collection', { format: 'collection' }),
      ad('ad-video-drop', 'as-video', 'Carousel · new drop', 'cr-carousel-drop', { format: 'carousel' }),

      ad('ad-dpa-warm', 'as-dpa-warm', 'Dynamic catalog · warm', 'cr-dpa', { format: 'collection' }),
      ad('ad-dpa-broad', 'as-dpa-broad', 'Dynamic catalog · broad', 'cr-dpa', { format: 'collection' }),
    ],
  });
}
