/**
 * The seven missions, one per Learn module.
 *
 * Each starts from an account broken in the specific way its module's lesson
 * fixes, and each is verified in scripts/validate-simulator.ts by playing it twice:
 * once applying the lesson, once applying a plausible wrong instinct. The lesson
 * has to pass and the wrong instinct has to fail, or the mission is not teaching
 * anything, it is just weather.
 */

import { ad, adSet, audience, campaign, state, DEFAULT_CONDITIONS } from '../factory';
import type { Mission } from './types';

export * from './types';
export { gradeMission, describeTarget, formatActual } from './grade';

export const MISSIONS: Mission[] = [
  // ─────────────────────────────────────────────────────── 1. Foundations ──
  {
    id: 'read-the-account',
    moduleSlug: 'foundations',
    order: 1,
    title: 'Read the account',
    situation:
      'You have inherited an account with four campaigns. Two are quietly losing money and the ' +
      'blended numbers are hiding it.',
    brief:
      'Find the campaigns that are not paying for themselves and stop them, without touching the ' +
      'ones that are. Get the account as a whole above break-even.',
    hints: [
      'Break-even here is 2.0x ROAS. Two campaigns are under it.',
      'Look at each campaign on its own before you look at the account total.',
      'Cost per result and ROAS disagree on which campaign is worst. Work out why.',
    ],
    durationDays: 14,
    xp: 120,
    objectives: [
      { id: 'roas', label: 'Lift account ROAS well clear of break-even', metric: 'roas', op: 'gte', value: 4.2, when: 'end', window: 7 },
      { id: 'volume', label: 'Without shutting the account down to do it', metric: 'purchases', op: 'gte', value: 250, when: 'end' },
    ],
    events: [],
    debrief:
      'A blended number is an average of things that are not alike. The two weak campaigns were ' +
      'pulling the account average down while looking survivable on their own cost per result, ' +
      'because a cheap purchase of a cheap product still loses money. ROAS answers the question ' +
      'cost per result cannot: not "what did this cost" but "did it pay for itself". The second ' +
      'objective exists because pausing everything would have hit the first one trivially, and ' +
      'an account with no volume is not a fixed account.',
    buildState: () => state({
      conditions: { ...DEFAULT_CONDITIONS, aov: 900 },
      audiences: [
        audience('a-broad', 'Broad 18–34', 3_400_000, 0.05),
        audience('a-interest', 'Interest stack', 900_000, 0.12),
        audience('a-cart', 'Cart abandoners · 7 day', 21_000, 0.95, { type: 'custom' }),
        // Deliberately awful: a tiny, cold, expensive pool with a mismatched creative.
        audience('a-vanity', 'Lookalike 10% · untested', 2_100_000, 0.02, { type: 'lookalike' }),
      ],
      campaigns: [
        campaign('c-broad', 'Prospecting · Broad', { strategyTag: 'prospecting' }),
        campaign('c-interest', 'Prospecting · Interests', { strategyTag: 'prospecting' }),
        campaign('c-retarget', 'Retargeting · Cart', { strategyTag: 'retargeting' }),
        campaign('c-vanity', 'Prospecting · Lookalike 10%', { strategyTag: 'prospecting' }),
      ],
      adSets: [
        adSet('as-broad', 'c-broad', 'Broad 18–34', 'a-broad', { dailyBudget: 3_500 }),
        adSet('as-interest', 'c-interest', 'Interest stack', 'a-interest', { dailyBudget: 2_500 }),
        adSet('as-cart', 'c-retarget', 'Cart 7 day', 'a-cart', { dailyBudget: 1_500 }),
        adSet('as-vanity', 'c-vanity', 'Lookalike 10%', 'a-vanity', { dailyBudget: 3_000 }),
      ],
      ads: [
        ad('ad-broad', 'as-broad', 'UGC · street styling', 'cr-ugc-street', { format: 'video' }),
        ad('ad-interest', 'as-interest', 'Carousel · bestsellers', 'cr-carousel-best', { format: 'carousel' }),
        ad('ad-cart', 'as-cart', 'Still thinking it over?', 'cr-retarget-nudge'),
        // A warm-audience creative pointed at strangers: works nowhere, costs plenty.
        ad('ad-vanity', 'as-vanity', 'Still thinking it over?', 'cr-retarget-nudge'),
      ],
    }),
  },

  // ──────────────────────────────────────────── 2. Audiences & the Pixel ──
  {
    id: 'warm-vs-cold',
    moduleSlug: 'audiences',
    order: 2,
    title: 'Right message, right temperature',
    situation:
      'Every ad set is running the same cart-abandonment creative, including the ones pointed at ' +
      'people who have never heard of the brand.',
    brief:
      'Match creative to audience temperature. Cold audiences need a reason to care; warm ones ' +
      'need a reason to come back. Lift account CTR and keep the account profitable.',
    hints: [
      'A "still thinking it over?" ad is meaningless to someone who has never visited.',
      'Swapping an ad set\'s creative restarts its learning phase. Doing it to all of them at once has a cost.',
      'Look at CTR per ad set, not just at the account average.',
    ],
    durationDays: 14,
    xp: 130,
    objectives: [
      { id: 'ctr', label: 'Lift account CTR', metric: 'accountCtr', op: 'gte', value: 1.35, when: 'end', window: 7 },
      { id: 'roas', label: 'Stay profitable while you do it', metric: 'roas', op: 'gte', value: 2.2, when: 'end', window: 7 },
    ],
    events: [],
    debrief:
      'Creative and audience are one decision, not two. The retargeting nudge assumes context the ' +
      'cold audiences do not have, so it earned the click from nobody and paid full price for the ' +
      'privilege. Swapping in creative built for strangers (the founder story and the UGC) lifts ' +
      'CTR, and because engagement is an auction signal, it lowers CPM at the same time. The ' +
      'profitability objective is there because swapping every ad set at once restarts every ' +
      'learning phase simultaneously, which is an expensive way to be right.',
    buildState: () => state({
      conditions: { ...DEFAULT_CONDITIONS, aov: 900 },
      audiences: [
        audience('a-broad', 'Broad 18–34', 3_800_000, 0.05),
        audience('a-lal', 'Lookalike 3%', 700_000, 0.22, { type: 'lookalike' }),
        audience('a-cart', 'Cart abandoners · 7 day', 19_000, 0.95, { type: 'custom' }),
      ],
      campaigns: [
        campaign('c-cold', 'Prospecting', { strategyTag: 'prospecting' }),
        campaign('c-warm', 'Retargeting', { strategyTag: 'retargeting' }),
      ],
      adSets: [
        adSet('as-broad', 'c-cold', 'Broad 18–34', 'a-broad', { dailyBudget: 4_000 }),
        adSet('as-lal', 'c-cold', 'Lookalike 3%', 'a-lal', { dailyBudget: 3_000 }),
        adSet('as-cart', 'c-warm', 'Cart 7 day', 'a-cart', { dailyBudget: 1_600 }),
      ],
      ads: [
        ad('ad-broad', 'as-broad', 'Still thinking it over?', 'cr-retarget-nudge'),
        ad('ad-lal', 'as-lal', 'Still thinking it over?', 'cr-retarget-nudge'),
        ad('ad-cart', 'as-cart', 'Still thinking it over?', 'cr-retarget-nudge'),
      ],
    }),
  },

  // ────────────────────────────────────────────────────────── 3. Creative ──
  {
    id: 'refresh-the-winner',
    moduleSlug: 'creative',
    order: 3,
    title: 'The winner is wearing out',
    situation:
      'One ad has been carrying the account for weeks. It is still your best performer, and it is ' +
      'dying: frequency is climbing, CTR is sliding, and CPM is drifting up with it.',
    brief:
      'Keep the account performing while the creative burns out underneath you. Do not simply ' +
      'throw budget at it.',
    hints: [
      'Fatigue is a creative problem. More budget on a tired ad shows it to the same people more often.',
      'A fresh creative in the same ad set starts its own fatigue curve from zero.',
      'Not every creative wears out at the same rate. The hard-sell offer burns fastest.',
    ],
    durationDays: 21,
    xp: 140,
    objectives: [
      { id: 'ctr', label: 'Finish with CTR recovered', metric: 'accountCtr', op: 'gte', value: 1.35, when: 'end', window: 7 },
      { id: 'roas', label: 'Hold ROAS through the transition', metric: 'roas', op: 'gte', value: 2.2, when: 'end', window: 7 },
    ],
    events: [],
    debrief:
      'The frequency-up, CTR-down, CPM-up signature is creative fatigue, and it has exactly one ' +
      'fix: give people something new to look at. Raising the budget makes it worse, because the ' +
      'extra impressions land on the same saturated pool. Note that the ad set was never the ' +
      'problem, so rebuilding it would have thrown away a working audience and its learning ' +
      'phase along with it. The durable creative in the library (the UGC pieces) hold up far ' +
      'longer than the offer slab, which is why a pipeline matters more than any single winner.',
    buildState: () => {
      const s = state({
        conditions: { ...DEFAULT_CONDITIONS, aov: 900 },
        audiences: [
          audience('a-interest', 'Streetwear interests', 420_000, 0.15),
          audience('a-broad', 'Broad 18–34', 3_000_000, 0.05),
        ],
        campaigns: [campaign('c-main', 'Prospecting', { strategyTag: 'prospecting' })],
        adSets: [
          adSet('as-interest', 'c-main', 'Streetwear interests', 'a-interest', { dailyBudget: 6_000 }),
          adSet('as-broad', 'c-main', 'Broad 18–34', 'a-broad', { dailyBudget: 2_000 }),
        ],
        ads: [
          ad('ad-offer', 'as-interest', 'Offer · 20% off', 'cr-offer-slab'),
          ad('ad-broad', 'as-broad', 'Carousel · bestsellers', 'cr-carousel-best', { format: 'carousel' }),
        ],
      });
      // Starts mid-burn: the winning ad already carries the impressions and reach of
      // several weeks, so its fatigue curve bites from day one rather than day twenty.
      s.adSets[0].runtime.impressions = 900_000;
      s.adSets[0].runtime.reach = 205_000;
      s.adSets[0].runtime.spend = 84_000;
      s.adSets[0].runtime.purchases = 210;
      s.adSets[0].runtime.revenue = 189_000;
      s.adSets[0].runtime.trailingEvents = [9, 8, 7, 8, 6, 7, 6];
      s.adSets[0].runtime.learningState = 'active';
      s.adSets[0].runtime.budgetEma = 6_000;
      s.ads[0].runtime.impressions = 900_000;
      s.ads[0].runtime.clicks = 12_600;
      s.ads[0].runtime.spend = 84_000;
      return s;
    },
  },

  // ────────────────────────────────────────────────── 4. Budgets and CBO ──
  {
    id: 'escape-learning-limited',
    moduleSlug: 'budgets-cbo',
    order: 4,
    title: 'Eight ad sets, none of them learning',
    situation:
      'The account is split across eight ad sets on a budget that cannot support them. Every one ' +
      'of them is stuck in Learning Limited, and the costs show it.',
    brief:
      'Get the account out of Learning Limited without asking for more budget. You have the same ' +
      '₹12,000 a day you started with.',
    hints: [
      'An ad set needs roughly 50 optimisation events a week to stabilise. Work out what that costs here.',
      'Ten starving ad sets are worth less than three well-fed ones.',
      'There is a second escape route that does not involve pausing anything: optimise for a more frequent event.',
    ],
    durationDays: 21,
    xp: 150,
    objectives: [
      { id: 'limited', label: 'No live ad set left in Learning Limited', metric: 'adSetsLimited', op: 'lte', value: 0, when: 'end' },
      { id: 'spend', label: 'Still spending the budget', metric: 'dailySpend', op: 'gte', value: 9_000, when: 'end', window: 7 },
      { id: 'cpa', label: 'And buying purchases more cheaply', metric: 'cpa', op: 'lte', value: 420, when: 'end', window: 7 },
    ],
    events: [],
    debrief:
      'Learning Limited is not a warning, it is a price. An ad set that cannot gather ~50 events a ' +
      'week never settles, so it keeps paying exploration costs forever, which is why the cost per ' +
      'purchase fell as soon as the survivors stabilised. Two routes worked: concentrate the same ' +
      'money into fewer ad sets so each clears the threshold, or optimise for Add to Cart, which ' +
      'happens roughly three times as often as a purchase and clears the threshold at the budget ' +
      'you already had. The spend objective is there because switching everything off would have ' +
      'satisfied the first objective and taught you nothing.',
    buildState: () => state({
      conditions: { ...DEFAULT_CONDITIONS, aov: 900 },
      audiences: Array.from({ length: 8 }, (_, i) =>
        audience(`a-${i}`, `Interest segment ${i + 1}`, 420_000, 0.1)),
      campaigns: [campaign('c-main', 'Prospecting · Segments', { strategyTag: 'prospecting' })],
      adSets: Array.from({ length: 8 }, (_, i) =>
        adSet(`as-${i}`, 'c-main', `Segment ${i + 1}`, `a-${i}`, { dailyBudget: 1_500 })),
      ads: Array.from({ length: 8 }, (_, i) =>
        ad(`ad-${i}`, `as-${i}`, `UGC · segment ${i + 1}`, 'cr-ugc-street', { format: 'video' })),
    }),
  },

  // ─────────────────────────────────────────────────────────── 5. Testing ──
  {
    id: 'a-clean-test',
    moduleSlug: 'testing',
    order: 5,
    title: 'Run a test you can believe',
    situation:
      'You have three creatives you have never run and one campaign using a campaign budget, which ' +
      'will pick a favourite within a day and starve the rest.',
    brief:
      'Set the account up so each creative gets a fair, funded read, then back the one that wins. ' +
      'Finish profitable.',
    hints: [
      'A campaign budget chases early front-runners. That is the wrong tool for a fair test.',
      'A clean test changes exactly one thing. Same audience, same budget, different creative.',
      'Each arm still needs enough conversions to be worth believing. Do not split so thin that none of them learn.',
    ],
    durationDays: 21,
    xp: 150,
    objectives: [
      { id: 'roas', label: 'Finish above break-even', metric: 'roas', op: 'gte', value: 2.3, when: 'end', window: 7 },
      { id: 'active', label: 'At least two ad sets out of the learning phase', metric: 'adSetsActive', op: 'gte', value: 2, when: 'end' },
    ],
    events: [],
    debrief:
      'Campaign Budget Optimization and testing are in direct conflict: CBO exists to concentrate ' +
      'spend on whatever looks best first, which is exactly what stops the other arms from ever ' +
      'gathering enough data to be judged. Moving the budget down to the ad sets gives each arm a ' +
      'guaranteed read. The second objective is the one that catches over-splitting: three arms on ' +
      'a budget that only supports two means nothing stabilises and the test is unreadable either ' +
      'way. Test with ad set budgets, then scale the winner with a campaign budget.',
    buildState: () => state({
      conditions: { ...DEFAULT_CONDITIONS, aov: 900 },
      audiences: [audience('a-broad', 'Broad 18–34', 3_200_000, 0.08)],
      campaigns: [
        campaign('c-test', 'Creative test', {
          strategyTag: 'prospecting', budgetMode: 'cbo', dailyBudget: 9_000,
        }),
      ],
      adSets: [
        adSet('as-a', 'c-test', 'Arm A', 'a-broad'),
        adSet('as-b', 'c-test', 'Arm B', 'a-broad'),
        adSet('as-c', 'c-test', 'Arm C', 'a-broad'),
      ],
      ads: [
        ad('ad-a', 'as-a', 'UGC · why I switched', 'cr-ugc-switch', { format: 'video' }),
        ad('ad-b', 'as-b', 'Founder story', 'cr-founder', { format: 'video' }),
        ad('ad-c', 'as-c', 'Static · lookbook grid', 'cr-lookbook'),
      ],
    }),
  },

  // ──────────────────────────────────────────────────────── 6. Optimising ──
  {
    id: 'diagnose-the-drop',
    moduleSlug: 'optimising',
    order: 6,
    title: 'Sales fell and the ads look fine',
    situation:
      'A week into the month, purchases fall off a cliff. Spend is steady, impressions are steady, ' +
      'and people are still clicking at the same rate as before. Separately, one ad set has never ' +
      'been funded properly and has sat in Learning Limited since launch.',
    brief:
      'Work out where the funnel actually broke, and do not spend the fortnight fixing the part ' +
      'that was never broken. Fix what is genuinely wrong with the account, and recover by the end.',
    hints: [
      'Walk the chain in order: CPM, then CTR, then conversion rate. Stop at the first thing that moved.',
      'CTR being flat is information. It rules something out.',
      'Some problems are not ad problems, and no amount of ad optimisation fixes them.',
      'One thing here genuinely is an ads problem, and it was broken before the drop.',
    ],
    durationDays: 21,
    xp: 160,
    objectives: [
      { id: 'roas', label: 'Account recovered by the end', metric: 'roas', op: 'gte', value: 2.3, when: 'end', window: 7 },
      { id: 'spend', label: 'Without retreating from the market', metric: 'dailySpend', op: 'gte', value: 5_000, when: 'end', window: 7 },
      { id: 'stable', label: 'And the starved prospecting ad set stabilised', metric: 'adSetsActive', op: 'gte', value: 2, when: 'end' },
    ],
    events: [
      {
        day: 7,
        kind: 'landingPageQuality',
        factor: 0.42,
        headline: 'Purchases down sharply. Spend, impressions and CTR unchanged.',
        cause: 'A checkout script started failing on mobile, so most of the traffic you paid for could not complete an order.',
      },
      {
        day: 14,
        kind: 'landingPageQuality',
        factor: 2.38,
        headline: 'Conversion rate back to normal.',
        cause: 'The checkout fix shipped. Notice the recovery owed nothing to the ads.',
      },
    ],
    debrief:
      'Good CPM plus good CTR plus terrible conversion rate isolates the break to after the click. ' +
      'The ads kept doing their job the entire time: they bought impressions at the usual price and ' +
      'earned clicks at the usual rate. Rebuilding creative or widening the audience would have ' +
      'spent the fortnight on the one part of the funnel the data already cleared. The second ' +
      'objective catches the other common wrong answer, cutting spend to protect the ROAS number, ' +
      'which shrinks the business to make a metric look better. The third objective is the point of ' +
      'the whole exercise: there was a genuine ads problem sitting in plain sight the entire time, ' +
      'an ad set too poorly funded to ever leave Learning Limited, and the noise of the checkout ' +
      'break is exactly what stops most people from noticing it. Worth noticing what the ' +
      'objective does not ask for: the cart-abandoner ad set stays in Learning Limited whatever ' +
      'you do, because a 22,000-person pool cannot produce 50 purchases a week at any budget. ' +
      'Adding money there only raises frequency and CPM. Its escape is the other one module 4.2 ' +
      'describes, optimising for a more frequent event, and some ad sets simply have a ceiling.',
    buildState: () => state({
      conditions: { ...DEFAULT_CONDITIONS, aov: 900 },
      audiences: [
        audience('a-broad', 'Broad 18–34', 3_200_000, 0.06),
        audience('a-cart', 'Cart abandoners · 7 day', 22_000, 0.95, { type: 'custom' }),
        audience('a-interest', 'Streetwear interests', 520_000, 0.12),
      ],
      campaigns: [
        campaign('c-cold', 'Prospecting', { strategyTag: 'prospecting' }),
        campaign('c-warm', 'Retargeting', { strategyTag: 'retargeting' }),
      ],
      adSets: [
        adSet('as-broad', 'c-cold', 'Broad 18–34', 'a-broad', { dailyBudget: 5_000 }),
        adSet('as-cart', 'c-warm', 'Cart 7 day', 'a-cart', { dailyBudget: 1_800 }),
        // The real ads problem, and it predates the drop: far too little budget to
        // ever reach 50 events a week, so it has been paying exploration costs since
        // launch. Easy to miss once the checkout break starts making noise.
        adSet('as-interest', 'c-cold', 'Streetwear interests', 'a-interest', { dailyBudget: 600 }),
      ],
      ads: [
        ad('ad-broad', 'as-broad', 'UGC · street styling', 'cr-ugc-street', { format: 'video' }),
        ad('ad-cart', 'as-cart', 'Still thinking it over?', 'cr-retarget-nudge'),
        ad('ad-interest', 'as-interest', 'Carousel · bestsellers', 'cr-carousel-best', { format: 'carousel' }),
      ],
    }),
  },

  // ─────────────────────────────────────────────────────────── 7. Scaling ──
  {
    id: 'scale-without-breaking',
    moduleSlug: 'scaling',
    order: 7,
    title: 'Triple the spend, keep the economics',
    situation:
      'You have a profitable account running at about ₹6,000 a day. The brand wants ₹18,000 a day ' +
      'by the end of the month.',
    brief:
      'Get spend to ₹18,000 a day and hold ROAS above break-even the whole way. A ROAS dip while ' +
      'scaling is normal; falling below break-even is not.',
    hints: [
      'A large overnight budget increase forces delivery into pricier, worse-converting inventory.',
      'There are two directions to grow: more money on the same audience, or the same money on new ones.',
      'Duplicating an ad set onto the audience it already targets makes you bid against yourself.',
    ],
    durationDays: 28,
    xp: 180,
    objectives: [
      { id: 'spend', label: 'Reach the spend target', metric: 'dailySpend', op: 'gte', value: 16_000, when: 'end', window: 7 },
      { id: 'roas', label: 'Finish above break-even', metric: 'roas', op: 'gte', value: 2.1, when: 'end', window: 7 },
      { id: 'floor', label: 'Never let ROAS collapse on the way', metric: 'roas', op: 'gte', value: 2.05, when: 'everyDay' },
    ],
    events: [],
    debrief:
      'Scaling is a rate problem, not a size problem. Delivery settles at the spend level it has ' +
      'been running at, so asking it to spend three times that overnight makes it buy impressions ' +
      'it was previously outbid on, from people further from the ones converting. Gentle increases ' +
      'keep it inside the level it already knows, and horizontal expansion into genuinely new ' +
      'audiences adds spend without asking any single ad set to stretch. The everyday floor is the ' +
      'objective that separates the two approaches: both routes can hit ₹18,000, but only one gets ' +
      'there without a week of losing money.',
    buildState: () => {
      const s = state({
        conditions: { ...DEFAULT_CONDITIONS, aov: 900 },
        audiences: [
          audience('a-broad', 'Broad 18–34', 4_100_000, 0.06),
          audience('a-broad-35', 'Broad 35–54', 2_900_000, 0.06),
          audience('a-lal', 'Lookalike 3%', 680_000, 0.22, { type: 'lookalike' }),
          audience('a-interest', 'Streetwear interests', 760_000, 0.14),
          audience('a-cart', 'Cart abandoners · 7 day', 20_000, 0.95, { type: 'custom' }),
        ],
        campaigns: [
          campaign('c-cold', 'Prospecting', { strategyTag: 'prospecting' }),
          campaign('c-warm', 'Retargeting', { strategyTag: 'retargeting' }),
        ],
        adSets: [
          adSet('as-broad', 'c-cold', 'Broad 18–34', 'a-broad', { dailyBudget: 4_500 }),
          adSet('as-cart', 'c-warm', 'Cart 7 day', 'a-cart', { dailyBudget: 1_500 }),
        ],
        ads: [
          ad('ad-broad', 'as-broad', 'UGC · street styling', 'cr-ugc-street', { format: 'video' }),
          ad('ad-cart', 'as-cart', 'Still thinking it over?', 'cr-retarget-nudge'),
        ],
      });
      // Already settled at its current level, so a jump is a genuine departure from
      // the norm rather than a brand-new ad set finding its feet.
      for (const a of s.adSets) {
        a.runtime.budgetEma = a.dailyBudget ?? 0;
        a.runtime.learningState = 'active';
        a.runtime.trailingEvents = [12, 11, 13, 12, 10, 11, 12];
      }
      return s;
    },
  },
];

export function missionById(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function missionsForModule(moduleSlug: string): Mission[] {
  return MISSIONS.filter((m) => m.moduleSlug === moduleSlug);
}
