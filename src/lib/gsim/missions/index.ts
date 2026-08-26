/**
 * The seven Google Ads missions, one per Learn module.
 *
 * Each starts from an account that is broken in the specific way its module's
 * lesson fixes, and each is checked by the calibration gate against two things:
 * that doing the right thing passes, and that doing a *plausible wrong* thing
 * fails. The second matters more. A simulator in which every reasonable-looking
 * action improves the numbers teaches nothing except that ads are easy, and a
 * mission that can be passed by inaction is a cutscene.
 *
 * The starting accounts are shared with the sandbox on purpose. A learner who
 * spends a week free-playing NORTHBOUND's account and then opens Mission 2 should
 * recognise it, because recognising an account is most of the job.
 */

import { campaign, keyword } from '../state';
import type { GState } from '../engine/types';
import { buildD2CStartingAccount } from '../scenarios/d2c-starting';
import { buildD2CFixedAccount } from '../scenarios/d2c-fixed';
import { buildB2BStartingAccount } from '../scenarios/b2b-starting';
import { buildAppStartingAccount, NORTHBOUND_APP } from '../scenarios/app-starting';
import { VERTICALS } from '../verticals';
import type { GMission } from './types';

const D2C_BREAK_EVEN = 1 / VERTICALS.d2c.conditions.margin; // ≈ 2.17
const D2C_CEILING = VERTICALS.d2c.conditions.conversionValue * VERTICALS.d2c.conditions.margin;
const B2B_CEILING = VERTICALS.b2b.conditions.conversionValue * VERTICALS.b2b.conditions.margin;

/** Adds a Performance Max campaign beside whatever is already running. */
function withPmax(state: GState, dailyBudget: number): GState {
  state.campaigns.push(campaign({
    id: 'c-pmax',
    name: 'Performance Max — Shoes',
    type: 'pmax',
    dailyBudget,
    bidStrategy: 'maximise_conversions',
    pmaxReach: 1,
  }));
  return state;
}

export const GOOGLE_MISSIONS: GMission[] = [
  // ── 1. Foundations ───────────────────────────────────────────────────────
  {
    id: 'g-read-the-account',
    moduleSlug: 'foundations',
    order: 1,
    title: 'Read the account',
    situation:
      'NORTHBOUND\'s Google account has been running for a while and nobody has looked '
      + 'at it closely. Blended, it looks acceptable.',
    brief:
      'Find out where the money is actually going, and get the account clear of '
      + 'break-even without spending more than it spends today.',
    hints: [
      'Break-even here is 2.17× — anything below that is losing money on gross margin.',
      'Brand searches convert several times better than anything else and cost a fraction as much. Check what share of the conversions are brand, and what the rest look like without them.',
      'The search terms report shows what you bought. The keyword list shows what you asked for. They are not the same list.',
    ],
    durationDays: 14,
    xp: 120,
    buildState: buildD2CStartingAccount,
    objectives: [
      {
        id: 'roas',
        label: 'Finish the last week above 3.2× return on ad spend',
        metric: 'roas', op: 'gte', value: 3.2, when: 'end', window: 7,
        why:
          `Break-even is ${D2C_BREAK_EVEN.toFixed(2)}×, and the account already clears `
          + 'that on brand alone. This asks for enough headroom that brand is not the '
          + 'only reason.',
      },
      {
        id: 'spend',
        label: 'Put the budget to work — at least ₹21,000 across the last week',
        metric: 'cost', op: 'gte', value: 21_000, when: 'end', window: 7,
        why:
          'Pausing everything except the brand keyword takes return on ad spend past '
          + '20× and cannot spend half the budget, because brand is demand somebody '
          + 'else created and there is a fixed amount of it. Retreating to it is not '
          + 'reading the account either.',
      },
      {
        id: 'budget',
        label: 'And no more than ₹26,600 — the budget you were given',
        metric: 'cost', op: 'lte', value: 3800 * 7, when: 'end', window: 7,
        why: 'Spending more is not reading the account.',
      },
    ],
    debrief:
      'The blended numbers were hiding two accounts. One of them — the brand keyword — '
      + 'converts at ten per cent and costs twelve rupees a click. The other one was '
      + 'buying shoe repairs, school shoes, formal shoes and people researching how to '
      + 'clean trainers, at forty rupees a click and no conversions at all. Averaged '
      + 'together they looked survivable. Separated, one is the best inventory in India '
      + 'and the other is a bonfire.\n\n'
      + 'This is the single most common way a Google account hides its own condition, '
      + 'and it is why the first thing to do with any account you inherit is split brand '
      + 'out and look at what is left.',
  },

  // ── 2. Keywords & intent ────────────────────────────────────────────────
  {
    id: 'g-close-the-taps',
    moduleSlug: 'keywords',
    order: 2,
    title: 'Close the taps',
    situation:
      'Everything in this account is broad match and there is not a single negative '
      + 'keyword. The budget runs out by mid-afternoon every day.',
    brief:
      'Stop paying for searches that will never buy anything, and turn the budget that '
      + 'frees up into conversions.',
    hints: [
      'Sort the search terms report by cost and read down it. The terms doing the damage are not subtle.',
      'A negative blocks the exact phrase and nothing near it: excluding "free" leaves "no cost" running. Negate the words that appear, not the ideas.',
      'Once the waste stops, look at what the budget does instead. Money freed is money that has to land somewhere.',
    ],
    durationDays: 14,
    xp: 140,
    buildState: buildD2CStartingAccount,
    objectives: [
      {
        id: 'negatives',
        label: 'Have at least eight negative keywords in force',
        metric: 'negativeCount', op: 'gte', value: 8, when: 'end',
        why: 'The report has more than eight obvious ones in it.',
      },
      {
        id: 'cpa',
        label: `Get cost per order under ${money(1320)}`,
        metric: 'cpa', op: 'lte', value: 1320, when: 'end', window: 7,
        why:
          `It sits near ${money(1450)} today against a ${money(D2C_CEILING)} ceiling. `
          + 'Cost per order is what a negatives pass reliably moves — total waste is not, '
          + 'because the money you stop spending on one bad search lands on the next one.',
      },
      {
        id: 'spend',
        label: 'Still spend at least ₹21,000 across the last week',
        metric: 'cost', op: 'gte', value: 21_000, when: 'end', window: 7,
        why: 'Excluding everything is not the same as excluding the waste.',
      },
    ],
    debrief:
      'Negatives are usually taught as tidying, and they are not. This account was '
      + 'budget-limited: it was losing most of its eligible auctions not because its bids '
      + 'were low but because the money had already gone. Every rupee that stopped going '
      + 'to "shoe repair shop" was a rupee that went to a search that could convert '
      + 'instead. That is why cost per order falls further than the waste alone accounts '
      + 'for — you did not just save money, you redirected it.\n\n'
      + 'Watch what does *not* move while that happens. Total spend on non-converting '
      + 'search terms stays almost exactly where it was, and the single most expensive '
      + 'one can get worse — because on a capped budget the money you stop spending in '
      + 'one place has to land in another. The account improved; the metric that looks '
      + 'like it should have measured the improvement did not. Cost per order did.\n\n'
      + 'The other half of the lesson is what negatives do *not* do. They match literally. '
      + 'A learner who excluded "cheap" and expected "affordable" to stop appearing will '
      + 'have seen it keep appearing, because Google does not expand negatives to close '
      + 'variants the way it expands keywords.',
  },

  // ── 3. Ads & assets ─────────────────────────────────────────────────────
  {
    id: 'g-one-ad-four-themes',
    moduleSlug: 'ads',
    order: 3,
    title: 'One ad, four themes',
    situation:
      'Every keyword in this account sits in one ad group behind one ad and one landing '
      + 'page. The ad says "NORTHBOUND Shoes Online" and the keywords say trail, '
      + 'waterproof, flat feet and sneakers.',
    brief:
      'Raise the account\'s Quality Score, and make clicks cheaper without lowering a '
      + 'single bid.',
    hints: [
      'Quality Score has three components and the interface will tell you which one is failing. Hover the score.',
      'An ad can only contain so many keywords. If a group holds four unrelated themes, no ad in it can be relevant to more than one.',
      'The bid is not the lever here. Ad Rank is bid times quality, and quality is also the divisor on what you pay.',
    ],
    durationDays: 14,
    xp: 140,
    buildState: buildD2CStartingAccount,
    objectives: [
      {
        id: 'qs',
        label: 'Get the account\'s weighted Quality Score to 6.8 or better',
        metric: 'avgQualityScore', op: 'gte', value: 6.8, when: 'end', window: 7,
        why: 'It sits at 6.5 today, so this is not met by leaving it alone.',
      },
      {
        id: 'ctr',
        label: 'Raise click-through above 6%',
        metric: 'ctr', op: 'gte', value: 0.06, when: 'end', window: 7,
        why: 'A relevant ad in a better slot earns more clicks from the same impressions.',
      },
      {
        id: 'roas',
        label: 'Finish above 3× return on ad spend',
        metric: 'roas', op: 'gte', value: 3, when: 'end', window: 7,
      },
    ],
    debrief:
      'Splitting an ad group is not organisation for its own sake. Ad relevance is '
      + 'measured on whether the ad contains its keyword\'s own ideas, so a group holding '
      + 'four themes has a ceiling on its Quality Score that no amount of good copy can '
      + 'lift — one ad physically cannot say four things and mean any of them.\n\n'
      + 'And Quality Score is not a badge. It multiplies your Ad Rank *and* divides your '
      + 'cost per click, so improving it buys a better position and a lower price at the '
      + 'same time. That is the only lever in the account that does both.',
  },

  // ── 4. Quality Score ────────────────────────────────────────────────────
  {
    id: 'g-below-first-page',
    moduleSlug: 'quality-score',
    order: 4,
    title: 'Rarely shown',
    situation:
      'Two keywords in this account are entering thousands of auctions a day and showing '
      + 'in almost none of them. Their bids are not low.',
    brief:
      'Get every active keyword serving, and do it without raising bids past what the '
      + 'margin can carry.',
    hints: [
      'Read the status column, not the bid column. "Rarely shown due to low Quality Score" and "below first page bid" are different diagnoses.',
      'There is a reserve price. Below it nothing shows at all, with no competitor required — and the reserve is a *rank*, so quality moves it.',
      'A keyword whose ad shares none of its words scores badly on ad relevance before it has served a single impression.',
    ],
    durationDays: 12,
    xp: 150,
    buildState: () => {
      const state = buildD2CStartingAccount();
      // Budget deliberately generous. This mission is about Ad Rank, and on a
      // budget-limited account almost nothing is lost to rank — the money runs out
      // before the auctions do, and "lost to rank" reads as a rounding error no
      // matter how bad the quality is. Take the money constraint away and the
      // quality constraint is the only one left, which is the point.
      state.campaigns[0].dailyBudget = 18_000;
      state.adGroups[0].landingPageQuality = 0.55;
      // An ad that answers none of its keywords. Ad relevance is measured on
      // whether the ad contains the keyword's own ideas, so this one scores the
      // floor on every keyword in the group no matter how good the copy reads.
      state.ads[0].headlines = ['Shop The Sale', 'Free Delivery Across India', 'New Arrivals Every Week'];
      state.ads[0].descriptions = ['Free delivery across India. 30-day returns on everything.'];
      // Bids set where quality decides the outcome. High enough that a well-built
      // account would serve comfortably, low enough that a poorly-built one loses
      // the auction — which is the whole shape of the lesson.
      for (const k of state.keywords) k.maxCpc = 34;
      state.adGroups[0].defaultCpc = 34;
      state.keywords.push(
        keyword({ id: 'k-waterproof', adGroupId: 'g-everything', text: 'waterproof running shoes', match: 'phrase', maxCpc: 34 }),
        keyword({ id: 'k-flatfeet', adGroupId: 'g-everything', text: 'running shoes for flat feet', match: 'phrase', maxCpc: 34 }),
      );
      return state;
    },
    objectives: [
      {
        id: 'qs',
        label: 'Get the account\'s weighted Quality Score to 6 or better',
        metric: 'avgQualityScore', op: 'gte', value: 6, when: 'end', window: 7,
      },
      {
        id: 'rank',
        label: 'Cut auctions lost on Ad Rank below 25%',
        metric: 'lostToRankShare', op: 'lte', value: 0.25, when: 'end', window: 7,
        why: 'Losing on rank is a quality problem or a bid problem. This asks you to solve the first.',
      },
      {
        id: 'cpc',
        label: `Keep the average click under ${money(45)}`,
        metric: 'cpc', op: 'lte', value: 45, when: 'end', window: 7,
        why: 'Bidding your way out would push this straight through the ceiling.',
      },
    ],
    debrief:
      'A keyword can fail to show with no competitors in the auction at all. Ad Rank has '
      + 'to clear a reserve before anything serves, and because rank is bid times quality, '
      + 'the reserve reads as a sliding minimum bid: at quality 1.0 a ₹14 bid clears it, at '
      + '0.5 you need ₹28, at 0.25 you need ₹56. That sliding scale is the whole argument '
      + 'for fixing quality instead of raising bids, and it is why the argument eventually '
      + 'becomes unanswerable — there is a point past which no bid you can afford is enough.\n\n'
      + 'Worth carrying forward: a high Quality Score does not mean a keyword makes money. '
      + 'It measures whether people click, not whether they buy.',
  },

  // ── 5. Bidding & budgets ────────────────────────────────────────────────
  {
    id: 'g-lost-impression-share',
    moduleSlug: 'bidding',
    order: 5,
    title: 'Where the impressions went',
    situation:
      'This account wins about one in eight of the auctions it enters. The finance team '
      + 'has approved more budget and wants to know whether to spend it.',
    brief:
      'Work out whether the missing impressions are a money problem or a rank problem, '
      + 'and grow conversions without losing money doing it.',
    hints: [
      'The impression-share bar splits three ways for a reason. Lost to budget and lost to rank have different answers.',
      'More budget on an account that is buying the wrong searches buys more of the wrong searches. Check what the extra money would land on before you approve it.',
      'Smart Bidding is not free. A strategy with no conversion history behind it bids everything as though it were average — which under-values your best searches and over-values your worst.',
    ],
    durationDays: 18,
    xp: 160,
    buildState: buildD2CStartingAccount,
    objectives: [
      {
        id: 'conversions',
        label: 'Finish the last week with at least 22 orders',
        metric: 'conversions', op: 'gte', value: 22, when: 'end', window: 7,
      },
      {
        id: 'roas',
        label: `Never let a three-day stretch fall below break-even (${D2C_BREAK_EVEN.toFixed(2)}×)`,
        metric: 'roas', op: 'gte', value: D2C_BREAK_EVEN, when: 'everyDay', window: 3,
        why: 'Growth that loses money is not growth. Three days so one quiet Sunday is not the verdict.',
      },
      {
        id: 'budget',
        label: 'Cut auctions lost to budget below 55%',
        metric: 'lostToBudgetShare', op: 'lte', value: 0.55, when: 'end', window: 7,
      },
    ],
    debrief:
      'Both halves of this are traps. Approving the budget without fixing what the account '
      + 'buys makes things worse in a measurable way — the extra money goes to the same '
      + 'searches in the same proportions, so cost per order rises and return falls. But '
      + 'refusing the budget on an account that has been fixed leaves conversions on the '
      + 'table, because lost-to-budget was real: those were auctions the account was '
      + 'eligible for and declined to enter.\n\n'
      + 'The order matters and it only goes one way. Fix what you are buying, then buy more '
      + 'of it. Reversing those two steps is the most expensive mistake in paid search and '
      + 'it is made every quarter, in every company, by somebody with a spreadsheet.',
  },

  // ── 6. Shopping & Performance Max ───────────────────────────────────────
  {
    id: 'g-pmax-takes-the-brand',
    moduleSlug: 'shopping',
    order: 6,
    title: 'The campaign that eats brand',
    situation:
      'A Performance Max campaign was launched last week alongside the Search account. '
      + 'It is reporting an excellent return. The Search campaign\'s brand keyword is '
      + 'suddenly showing far less often, and nobody changed it.',
    brief:
      'Work out where the brand traffic went, get it back, and keep the account\'s '
      + 'overall return where it was or better.',
    hints: [
      'Performance Max reports search categories, not search terms. It will not tell you what it bought. Look at what the Search campaign stopped winning instead.',
      'One advertiser gets one ad per auction. If two of your campaigns want the same search, one of them loses — and losing shows up as impression share, not as an error.',
      'There are two fixes and they work differently. One excludes the traffic from Performance Max; the other outranks it by rule.',
    ],
    durationDays: 14,
    xp: 170,
    // Starts from a *tidied* account rather than the sprawling one, and this is the
    // whole reason the mission sits sixth. Brand has to be split out and funded
    // before anyone can see Performance Max take it: on the starting account brand
    // shares one budget with five broad keywords, loses most of its auctions to
    // money rather than to rank, and the cannibalisation is invisible underneath
    // that. You cannot diagnose a rank problem inside a budget problem.
    buildState: () => {
      const state = buildD2CFixedAccount();
      // Brand funded properly, so that losing brand auctions is unambiguously a
      // rank problem. On the ₹600 the tidy account gives it, brand loses most of
      // its auctions to money, and a rank problem is not diagnosable inside a
      // budget problem — which is the same reason this mission does not start from
      // the sprawling account.
      state.campaigns.find((c) => c.id === 'c-brand')!.dailyBudget = 2000;
      // Brand held on phrase match rather than exact. This is the detail the
      // mission turns on: an exact-match keyword identical to the query takes
      // precedence over Performance Max by rule, so an account already holding
      // brand on exact has nothing to discover here.
      state.keywords.find((k) => k.id === 'f-brand-e')!.match = 'phrase';
      return withPmax(state, 3000);
    },
    objectives: [
      {
        id: 'brand',
        label: 'Win at least 80% of your brand auctions back in the Search campaigns',
        metric: 'brandImpressionShare', op: 'gte', value: 0.8, when: 'end', window: 7,
        why: 'Brand is finite and cheap. Whoever holds it decides what the account costs.',
      },
      {
        id: 'nonbrand',
        label: 'Keep at least 24 non-brand orders in the last week',
        metric: 'nonBrandConversions', op: 'gte', value: 24, when: 'end', window: 7,
        why:
          'Pausing Performance Max hands brand straight back and takes return on ad '
          + 'spend to its highest of any option here. It also costs two-thirds of the '
          + 'account\'s non-brand orders, because the campaign was genuinely buying '
          + 'those. Getting brand back is not the same as switching the thing off.',
      },
      {
        id: 'roas',
        label: 'Finish above 6× return on ad spend across the whole account',
        metric: 'roas', op: 'gte', value: 6, when: 'end', window: 7,
      },
    ],
    debrief:
      'Performance Max bids what a click is worth, and a brand click is worth more than '
      + 'anything else in the account. So it out-ranks the Search campaign that was already '
      + 'winning those searches, takes the cheapest and best-converting traffic you have, '
      + 'and reports a superb return for doing it. Nothing in either interface flags this. '
      + 'The only evidence is a fall in the Search campaign\'s brand impression share on a '
      + 'day when nothing about the Search campaign changed.\n\n'
      + 'Two fixes, and it is worth knowing why they differ. A brand exclusion on '
      + 'Performance Max stops it entering those auctions at all. An exact-match brand '
      + 'keyword in a Search campaign takes precedence over Performance Max by rule, '
      + 'regardless of Ad Rank — which is the only case where a Search campaign is '
      + 'guaranteed to win against it. Either works here.\n\n'
      + 'What does not work is the obvious third option. Pausing the campaign returns '
      + 'brand immediately and takes the account\'s return on ad spend higher than any '
      + 'other answer on this page — and costs roughly two-thirds of its non-brand '
      + 'orders, because Performance Max was genuinely buying those. A campaign doing '
      + 'one thing wrong and one thing well is the normal case, and the skill is '
      + 'separating them rather than reaching for the switch.',
  },

  // ── 7. Optimising & scaling ─────────────────────────────────────────────
  {
    id: 'g-cheapest-installs',
    moduleSlug: 'optimising',
    order: 7,
    title: 'The cheapest installs in the market',
    situation:
      'NORTHBOUND\'s App campaign is reporting a cost per install of about thirty rupees, '
      + 'which is the best number in the whole account. The app team is delighted. Revenue '
      + 'from the app has not moved.',
    brief:
      'Find out why, and get the campaign producing customers the business can afford.',
    hints: [
      `An order is worth ${money(NORTHBOUND_APP.eventValue)} and the margin allows about ${money(D2C_CEILING)} to acquire one. Compare that with what a first purchase is actually costing.`,
      'The channel table shows cost per install next to cost per first purchase. Read them together — the columns disagree, and the disagreement is the point.',
      'You cannot choose where an App campaign runs. You can only change what you ask it to optimise for, and the mix follows.',
    ],
    durationDays: 21,
    xp: 180,
    buildState: buildAppStartingAccount,
    objectives: [
      {
        id: 'cpe',
        label: `Get cost per first purchase under ${money(D2C_CEILING * 0.8)}`,
        metric: 'appCostPerEvent', op: 'lte', value: D2C_CEILING * 0.8, when: 'end', window: 7,
        why: `The ceiling is ${money(D2C_CEILING)}. Under it with room to spare.`,
      },
      {
        id: 'activation',
        label: 'Get at least 5% of installs to make a first purchase',
        metric: 'appActivation', op: 'gte', value: 0.05, when: 'end', window: 7,
        why: 'It starts near 1%. The installs themselves have to become different people.',
      },
      {
        id: 'volume',
        label: 'Produce at least 25 first purchases in the last week',
        metric: 'conversions', op: 'gte', value: 25, when: 'end', window: 7,
        why: 'Throttling the campaign to almost nothing would meet the cost targets and help nobody.',
      },
    ],
    debrief:
      'Cost per install is the number every app team reports and the one that means '
      + 'least. The cheapest installs in this market come from Display and Discover, where '
      + 'an install is often a mis-tap inside another app, and roughly one in six hundred '
      + 'of them ever buys anything. The dearest come from Search, where somebody typed the '
      + 'category into Google and meant it.\n\n'
      + 'Changing the goal from installs to the first purchase moves the budget from the '
      + 'first group to the second. The reported cost per install gets three times worse '
      + 'and the business gets better, which is exactly why this is hard to do inside a '
      + 'real company: the metric on the weekly deck moves the wrong way for a quarter '
      + 'while the thing it was supposed to be measuring improves.',
  },
];

/** Rupees, for mission copy. */
function money(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function googleMissionById(id: string): GMission | undefined {
  return GOOGLE_MISSIONS.find((m) => m.id === id);
}

export { B2B_CEILING, D2C_BREAK_EVEN, D2C_CEILING };
export { buildB2BStartingAccount };
export type { GMission } from './types';
