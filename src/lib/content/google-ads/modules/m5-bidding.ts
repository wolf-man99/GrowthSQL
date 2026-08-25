import type { GoogleLesson } from '../types';
import { p, list, key } from '../types';

/**
 * Module 5: Bidding & budgets. Handing control to the machine, on purpose.
 *
 * The module's spine is a prerequisite rather than a preference: every Smart
 * Bidding strategy is a conversion-data engine, so the honest order is conversion
 * tracking first, strategy second. Teaching tROAS to someone whose Purchase event
 * has no value attached would be teaching them to trust a number that cannot exist.
 */
export const G5_LESSONS: GoogleLesson[] = [
  // ─────────────────────────────────────────────────────────── Lesson 5.1 ──
  {
    slug: 'conversion-tracking',
    moduleSlug: 'bidding',
    title: 'Conversion tracking comes first',
    subtitle: 'Everything downstream depends on it',
    minutes: 9,
    xp: 70,
    objective: 'Set up conversions that Smart Bidding can actually learn from, and spot the ones that poison it.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'The signal everything else runs on',
        blocks: [
          p('Smart Bidding does not know what a good click looks like. It knows what a click that *converted* looked like, and then goes hunting for more of them. Take the conversion signal away and every automated strategy in Google Ads degrades to guessing.'),
          p('So the order is not negotiable: conversion tracking, then Smart Bidding. Reversed, you get automation optimising confidently toward nothing.'),
          key('No conversion tracking → no Smart Bidding, no useful broad match, no Performance Max. It is the foundation, not a reporting nicety.'),
        ],
      },
      {
        kind: 'teach', id: 'c2', title: 'Primary and secondary',
        blocks: [
          p('Google lets you mark each conversion action as primary or secondary. Only **primary** actions are bid toward; secondary ones are recorded for reporting and ignored by bidding.'),
          p('This matters more than it sounds. If newsletter signups are primary alongside purchases, Smart Bidding will happily buy a hundred cheap signups instead of five sales, because it is doing exactly what you asked.'),
          list([
            '**Primary** — the thing that makes money. Usually one action.',
            '**Secondary** — useful context: add to cart, page views, video plays.',
          ]),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'An ecommerce account has Purchase, Add to Cart and Newsletter Signup all set as primary. What goes wrong?',
        options: [
          'Nothing, more data is better',
          'Bidding optimises toward the cheapest and most frequent action, which is signups, not revenue',
          'Conversion tracking stops working',
          'Reporting breaks',
        ],
        answer: 1,
        explain: 'Smart Bidding maximises the count of primary conversions. Signups are far cheaper and far more common than purchases, so the algorithm rationally buys those instead. Purchase should be the only primary; the others belong as secondary.',
      },
      {
        kind: 'teach', id: 'c3', title: 'Send a value, not just a count',
        blocks: [
          p('A conversion with no value is a conversion Google treats as identical to every other. A ₹400 order and a ₹40,000 order both count as one, and the algorithm will chase whichever is easier to get.'),
          p('Sending dynamic conversion values unlocks the value-based strategies (Maximise conversion value, tROAS), and immediately improves even the count-based ones because it changes what the account is seen to be worth.'),
        ],
      },
      {
        kind: 'truefalse', id: 'q2',
        statement: 'A conversion window that is too short can make a good campaign look bad.',
        isTrue: true,
        explain: 'True. If people typically take 12 days to buy and your window is 7, you attribute away a third of your own conversions — and Smart Bidding learns from the truncated picture too. Match the window to your real purchase cycle, measured rather than assumed.',
      },
      {
        kind: 'scenario', id: 'q3',
        situation: 'A B2B client wants Target CPA bidding. They have 4 conversions in the last 30 days.',
        options: [
          { label: 'Set it up — Target CPA is the modern approach', correct: false, feedback: 'Four data points in a month is not enough for any bidding algorithm to distinguish signal from luck. It will swing wildly and blame itself.' },
          { label: 'Use Maximise clicks or manual CPC while you build volume, and track a mid-funnel action like qualified form fills as an interim primary', correct: true, feedback: 'Right. Low-volume accounts need a more frequent conversion to learn from. Optimise toward a leading indicator that correlates with revenue until the real conversion has the volume to steer with.' },
          { label: 'Widen the conversion window to 90 days to get more conversions', correct: false, feedback: 'It surfaces slightly more history but does not create volume, and it makes feedback slower — worse for learning, not better.' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 5.2 ──
  {
    slug: 'bidding-strategies',
    moduleSlug: 'bidding',
    title: 'Choosing a bidding strategy',
    subtitle: 'Manual through to tROAS',
    minutes: 11,
    xp: 90,
    objective: 'Pick the strategy that matches the data you actually have, and know what each one is optimising for.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'A ladder of control', art: 'bidding-ladder',
        blocks: [
          p('Bidding strategies form a ladder. Each rung hands Google more control in exchange for more per-auction intelligence than a human could apply.'),
          list([
            '**Manual CPC** — you set every bid. Total control, no per-auction signals.',
            '**Maximise clicks** — cheapest traffic possible. Good for building data, indifferent to quality.',
            '**Maximise conversions** — as many conversions as the budget allows, at whatever CPA.',
            '**Target CPA** — as many conversions as possible while holding an average cost per conversion.',
            '**Maximise conversion value** — the most revenue the budget can buy, ignoring efficiency.',
            '**Target ROAS** — the most revenue that still clears a return threshold.',
          ]),
          key('Higher rungs are not better; they are hungrier. Each one needs more conversion data than the one below it, and starves without it.'),
        ],
      },
      {
        kind: 'teach', id: 'c2', title: 'What each one is really for',
        blocks: [
          p('**Maximise clicks** is a data-gathering tool, not a performance strategy. It is the right answer for a brand new campaign with no history, and the wrong answer three weeks later.'),
          p('**Maximise conversions** suits a fixed budget you intend to spend fully — it will spend it all, and CPA is whatever it turns out to be.'),
          p('**Target CPA** suits a business with a known acceptable cost per lead or sale. Set it near your recent actual CPA; set it far below and delivery collapses because almost no auction qualifies.'),
          p('**Target ROAS** suits ecommerce with real conversion values, where a ₹5,000 order and a ₹500 order should not be treated alike.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'An account averages ₹1,200 CPA. You set Target CPA to ₹400. What happens?',
        options: [
          'CPA falls to ₹400',
          'Impressions and spend collapse, because almost no auction clears the target',
          'Nothing changes',
          'Google ignores the target',
        ],
        answer: 1,
        explain: 'Target CPA is a constraint, not a wish. At a third of the achievable cost, Google bids so low it wins almost nothing — and the few conversions it does get are too sparse to learn from. Move targets by 10–20% at a time from where you actually are.',
      },
      {
        kind: 'calc', id: 'calc1', variant: 'target-cpa',
        title: 'What target should you set?',
        blurb: 'From margin and order value to a defensible target CPA and target ROAS. Set the constraint from the economics, not from the current number.',
      },
      {
        kind: 'teach', id: 'c3', title: 'The learning period',
        blocks: [
          p('Change a bidding strategy or move a target significantly and the campaign re-enters a learning phase, typically around a week. Performance during it is unstable and unrepresentative.'),
          p('The expensive mistake is judging a new strategy after four days, reverting, and thereby starting a fresh learning period — an account can spend months permanently in learning, never stable long enough to be judged.'),
          key('Change one thing, then leave it alone for two weeks. Almost everyone finds this the hardest habit in the whole discipline.'),
        ],
      },
      {
        kind: 'sort', id: 'q2',
        prompt: 'Order these by how much conversion data they need, least first.',
        items: ['Maximise clicks', 'Maximise conversions', 'Target CPA', 'Target ROAS'],
        explain: 'Maximise clicks needs none — it optimises for traffic. Maximise conversions needs some. Target CPA needs enough to hold an average. Target ROAS needs conversion values on top of volume, which is the most demanding requirement of the four.',
      },
      {
        kind: 'scenario', id: 'q3',
        situation: 'A campaign on Target ROAS at 400% has been stable for two months. The client wants to scale spend 3x.',
        options: [
          { label: 'Triple the budget and hold the target', correct: false, feedback: 'The target is what limits spend, not the budget. Holding it at 400% means Google still only bids on auctions it believes clear 400%, so spend barely moves.' },
          { label: 'Lower the target in steps, accepting lower ROAS for more volume, and watch total profit rather than the ratio', correct: true, feedback: 'Right. ROAS and volume trade against each other: a lower target qualifies more auctions. Step down 10–15% at a time and judge on total profit, since a 3x business at 300% beats a 1x business at 400%.' },
          { label: 'Raise the target to 600% to make each sale more profitable', correct: false, feedback: 'That shrinks the campaign. A higher target disqualifies auctions, so spend and revenue both fall.' },
          { label: 'Switch to Maximise conversions', correct: false, feedback: 'It would spend the budget, but abandons the value weighting that a mixed-basket ecommerce account needs.' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 5.3 ──
  {
    slug: 'budgets-and-pacing',
    moduleSlug: 'bidding',
    title: 'Budgets, pacing and impression share',
    subtitle: 'Reading whether you are constrained by money or by rank',
    minutes: 9,
    xp: 80,
    objective: 'Tell a budget problem apart from a rank problem, and respond to each correctly.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Daily budget is an average, not a cap',
        blocks: [
          p('Google may spend up to twice your daily budget on any given day, balancing it out across the month. A ₹1,000/day budget can spend ₹1,900 on a Tuesday and ₹300 on a Wednesday.'),
          p('The real guarantee is monthly: you will not be charged more than roughly 30.4 × your daily budget in a billing period. Panicking at a single overspending day is a misreading of the mechanism.'),
        ],
      },
      {
        kind: 'teach', id: 'c2', title: 'Impression share tells you which wall you hit', art: 'impression-share',
        blocks: [
          p('Three columns together answer the most important structural question in the account:'),
          list([
            '**Search impression share** — the percentage of eligible auctions where your ad appeared.',
            '**Lost IS (budget)** — the share missed because the budget ran out.',
            '**Lost IS (rank)** — the share missed because Ad Rank was too low.',
          ]),
          p('The three sum to 100%, and which of the two losses dominates dictates a completely different response.'),
          key('Lost to budget → add money. Lost to rank → improve quality or raise bids. Adding budget to a rank problem changes nothing at all.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'Impression share 45%, lost to budget 5%, lost to rank 50%. What is the fix?',
        options: [
          'Increase the budget',
          'Improve Quality Score and/or raise bids',
          'Add more keywords',
          'Nothing is wrong',
        ],
        answer: 1,
        explain: 'Only 5% is being lost to money — the budget is nearly adequate. Half of all eligible auctions are lost because the ads do not rank, so the answer is relevance work or higher bids. Adding budget would leave it unspent.',
      },
      {
        kind: 'scenario', id: 'q2',
        situation: 'A campaign shows 30% impression share, 65% lost to budget, and a CPA well inside target.',
        options: [
          { label: 'Raise the budget', correct: true, feedback: 'Right, and it is one of the few genuinely easy wins in the discipline: profitable performance plus most impressions lost to budget means there is proven demand you are simply not paying for. Raise in steps of 20–30% so pacing stays stable.' },
          { label: 'Improve Quality Score first', correct: false, feedback: 'Always worth doing, but only 5% is being lost to rank here. The binding constraint is money.' },
          { label: 'Lower bids to stretch the budget further', correct: false, feedback: 'That buys cheaper, lower-position clicks and usually worsens CPA. The campaign is already profitable — the goal is more of it, not thinner.' },
          { label: 'Pause the worst keywords', correct: false, feedback: 'A reasonable tidy-up, but it does not address a campaign whose problem is that it runs out of money before it runs out of demand.' },
        ],
      },
      {
        kind: 'calc', id: 'calc1', variant: 'budget-headroom',
        title: 'How much headroom is there?',
        blurb: 'From current spend and impression share lost to budget, to the spend a fully funded campaign would reach.',
      },
      {
        kind: 'truefalse', id: 'q3',
        statement: 'A campaign limited by budget should have its bids lowered so the budget covers more clicks.',
        isTrue: false,
        explain: 'False, and it is a tempting trap. Lower bids mean lower positions and worse clicks; you get more of a worse thing. If a budget-limited campaign is profitable the answer is more budget, and if it is not profitable the answer is better targeting — not cheaper positions.',
      },
      {
        kind: 'tip', id: 't1', title: 'Raise budgets in steps',
        text: 'Smart Bidding paces against the budget it knows about. Tripling it overnight forces a rapid re-learn and usually a spike in CPA. Twenty to thirty percent every few days reaches the same place with far less turbulence — the same discipline that applies to scaling on Meta, for the same underlying reason.',
      },
    ],
  },
];
