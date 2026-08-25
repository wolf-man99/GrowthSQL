import type { GoogleLesson } from '../types';
import { p, list, key } from '../types';

/**
 * Module 3: Ads & assets. What the searcher actually reads.
 *
 * Meta's creative module is about stopping a scroll. This one is about answering
 * a question, which is a genuinely different craft: on Search the reader has
 * already told you what they want, and the winning ad is usually the one that
 * repeats it back most plainly rather than the one that is most clever.
 */
export const G3_LESSONS: GoogleLesson[] = [
  // ─────────────────────────────────────────────────────────── Lesson 3.1 ──
  {
    slug: 'responsive-search-ads',
    moduleSlug: 'ads',
    title: 'Responsive search ads',
    subtitle: 'Fifteen headlines, and Google picks',
    minutes: 10,
    xp: 80,
    objective: 'Write an RSA whose every combination reads well, and know when to override the machine.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'You write parts, Google assembles', art: 'rsa-anatomy',
        blocks: [
          p('A **responsive search ad** is not one ad. You supply up to 15 headlines (30 characters each) and 4 descriptions (90 characters each), and for every auction Google assembles a combination it thinks fits that searcher.'),
          p('Typically three headlines and two descriptions show at once. The number of possible combinations runs into the tens of thousands, which has one uncomfortable implication:'),
          key('Every headline must make sense next to every other headline. You are not writing an ad — you are writing parts that must survive being shuffled.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'Why is "Order Now And Save 20%" a risky headline in an RSA?',
        options: [
          'It is too long',
          'It could appear next to another discount headline and read as contradictory or spammy',
          'Percentages are not allowed',
          'Calls to action belong in descriptions',
        ],
        answer: 1,
        explain: 'Combined with "Free Shipping Over ₹999" and "Biggest Sale Of The Year" you get an ad that is three offers and no information. Because you cannot control the pairing, every headline has to be safe in any company.',
      },
      {
        kind: 'teach', id: 'c2', title: 'A headline mix that survives shuffling',
        blocks: [
          p('Think in categories rather than in fifteen separate ideas, and write two or three in each:'),
          list([
            '**The keyword itself** — "Running Shoes Online". Blunt, and the strongest relevance signal you have.',
            '**The differentiator** — "Free 30-Day Returns", "Made In India".',
            '**The proof** — "Rated 4.8 By 12,000 Runners".',
            '**The offer** — "20% Off First Order". At most one or two, or they collide.',
            '**The call to action** — "Shop The New Season".',
          ]),
          p('That mix means any three drawn together still form a coherent ad: something relevant, something persuasive, something to do next.'),
        ],
      },
      {
        kind: 'teach', id: 'c3', title: 'Pinning, and why to be sparing with it',
        blocks: [
          p('**Pinning** forces a headline into a fixed position. Pin "Official Northbound Store" to position 1 and it always shows first.'),
          p('It is the right tool for things that are not optional: a legal disclaimer, a regulated claim, your brand name on a brand campaign. It is the wrong tool for a copywriter\'s preference, because every pin cuts the combinations Google can test — and pinning all three positions turns your RSA back into a single static ad.'),
        ],
      },
      {
        kind: 'truefalse', id: 'q2',
        statement: 'Pinning your best headline to position 1 usually improves performance, because it always shows.',
        isTrue: false,
        explain: 'False. It guarantees that headline shows and prevents Google from finding a better combination for a given searcher. Unless a headline must appear for legal or brand reasons, leave it unpinned. Pin only what you cannot afford to have missing.',
      },
      {
        kind: 'teach', id: 'c4', title: 'Ad Strength: a hint, not a grade',
        blocks: [
          p('Google scores each RSA from Poor to Excellent. The score mostly measures whether you followed the format: enough headlines, enough variety, keywords included, few pins.'),
          p('It does not measure whether the ad sells. An "Average" ad can outperform an "Excellent" one, and chasing the label by padding in headlines you would not otherwise write is a common way to make an ad worse while making its score better.'),
          key('Use Ad Strength to catch obvious gaps — three headlines, everything pinned. Do not optimise for it. Optimise for conversions.'),
        ],
      },
      {
        kind: 'scenario', id: 'q3',
        situation: 'Your RSA shows "Average" Ad Strength but has the best conversion rate in the account. Google suggests adding six more headlines to reach "Excellent".',
        options: [
          { label: 'Add them — Excellent is the goal', correct: false, feedback: 'Adding headlines you do not believe in dilutes a combination set that is already working. The score improves and the ad gets worse.' },
          { label: 'Leave it, and test additions separately if you have genuinely good ones', correct: true, feedback: 'Right. Ad Strength measures format compliance, not results. A winning ad is evidence; a label is a suggestion. If you have real new angles, test them as a second ad rather than diluting the winner.' },
          { label: 'Pin the best headlines to protect performance', correct: false, feedback: 'That reduces the combinations that are currently producing your best conversion rate — the opposite of what the evidence supports.' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 3.2 ──
  {
    slug: 'assets-and-extensions',
    moduleSlug: 'ads',
    title: 'Assets',
    subtitle: 'Free real estate, and why they lift CTR',
    minutes: 8,
    xp: 70,
    objective: 'Add the asset types that earn their place, and understand why they help even when nobody clicks them.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'The extra lines under your ad',
        blocks: [
          p('**Assets** (formerly "ad extensions") are the extra pieces attached beneath a search ad: links, phone numbers, prices, snippets. They cost nothing to add and they do two things at once.'),
          list([
            'They make the ad **physically larger**, pushing competitors further down the page.',
            'They feed **Ad Rank** — expected asset impact is one of its components, so good assets can lift your position without a bid change.',
          ]),
          key('Assets are the only lever that increases your rank, lowers your effective cost and takes up more of the page, all for free.'),
        ],
      },
      {
        kind: 'teach', id: 'c2', title: 'The ones worth setting up first',
        blocks: [
          list([
            '**Sitelinks** — four to six deep links: Shop Men, Shop Women, Size Guide, Returns. The biggest CTR lift of any asset type.',
            '**Callouts** — short non-clickable claims: "Free Returns", "2-Year Warranty", "Ships In 24 Hours".',
            '**Structured snippets** — a labelled list: "Types: Running, Trail, Racing".',
            '**Price** — products with prices, straight in the ad. Pre-qualifies clicks, which cuts wasted spend.',
            '**Call** — a phone number. Essential for local and service businesses, irrelevant for most ecommerce.',
            '**Image** — a thumbnail beside the text ad. Underused, and it makes the ad look like a different format entirely.',
          ]),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'A sitelink gets almost no clicks. Is it doing anything?',
        options: [
          'No — remove it',
          'Yes — it enlarges the ad and contributes to Ad Rank whether or not it is clicked',
          'Only if it converts',
          'It hurts CTR',
        ],
        answer: 1,
        explain: 'Assets earn their place mostly by existing. The ad occupies more of the page, the expected-impact component of Ad Rank improves, and the headline gets more attention. Clicks on the sitelink itself are a bonus, not the point.',
      },
      {
        kind: 'teach', id: 'c3', title: 'Where they live, and why that matters',
        blocks: [
          p('Assets can be set at account, campaign or ad group level. Lower levels override higher ones, which gives a structure worth copying:'),
          list([
            '**Account** — the universal stuff: free returns, warranty, main site sections.',
            '**Campaign** — themed: a running campaign\'s sitelinks point at running categories.',
            '**Ad group** — occasionally, where a single tight theme deserves its own links.',
          ]),
          p('Set the account level once and most campaigns are covered from birth; specialise only where the generic version would be a poor answer to the search.'),
        ],
      },
      {
        kind: 'truefalse', id: 'q2',
        statement: 'Google shows every asset you add on every impression.',
        isTrue: false,
        explain: 'False. Google picks which assets to show per auction based on device, position and predicted performance. That is a reason to supply plenty of good ones — you are stocking a shelf it chooses from, not writing a fixed layout.',
      },
      {
        kind: 'tip', id: 't1', title: 'The half-hour that pays for itself',
        text: 'Six sitelinks, eight callouts and two structured snippet sets at account level, before you launch anything. It is the cheapest CTR improvement available and it applies to every campaign you will ever create in that account.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 3.3 ──
  {
    slug: 'landing-page-relevance',
    moduleSlug: 'ads',
    title: 'The page behind the click',
    subtitle: 'Where most Search budgets actually leak',
    minutes: 9,
    xp: 70,
    objective: 'Judge whether a landing page matches the search that reached it, and fix the mismatch.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'The click is the halfway point',
        blocks: [
          p('You can win the auction, write a perfect ad and still lose the sale in the two seconds after the click. Landing page experience is both a Quality Score component and, more importantly, where the money is actually made.'),
          p('The rule is continuity: whatever the searcher typed should be visibly present on the page they land on. Search "waterproof trail running shoes", land on a generic homepage, and the visitor has to start their search again — most will not.'),
          key('Every step between the search and the answer costs a share of the visitors. A homepage is almost always at least one step too many.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'Someone searches "waterproof trail running shoes" and clicks your ad. Best destination?',
        options: [
          'Homepage',
          'All shoes category',
          'Trail running shoes, filtered to waterproof',
          'Contact page',
        ],
        answer: 2,
        explain: 'Match the specificity of the query. The searcher named a category and an attribute; the page should show exactly that. Every extra click you make them perform to reach it loses a share of them, and you have already paid for the visit.',
      },
      {
        kind: 'teach', id: 'c2', title: 'What Google is judging',
        blocks: [
          p('Landing page experience is scored on things you can actually control:'),
          list([
            '**Relevance** — does the page contain what the ad promised, in the searcher\'s own words?',
            '**Transparency** — is it obvious what the business is, and how to contact it?',
            '**Navigability** — can a visitor get to the thing they came for without hunting?',
            '**Speed** — particularly on mobile, where most searches happen.',
          ]),
          p('Speed is the one most often ignored and most easily measured. A page that takes five seconds on a phone loses a substantial share of visitors before it renders at all, and you paid for every one of them.'),
        ],
      },
      {
        kind: 'scenario', id: 'q2',
        situation: 'CTR is strong, Quality Score is 4, and the landing page component says "Below average". The page loads in 6 seconds on mobile and sends all traffic to the homepage.',
        options: [
          { label: 'Raise bids to compensate for the low Quality Score', correct: false, feedback: 'That pays a permanent premium to work around a fixable problem. Quality Score divides your CPC, so the low score is costing you on every click regardless of bid.' },
          { label: 'Send each ad group to its matching category page and fix mobile load time', correct: true, feedback: 'Right, and note the order of benefits: conversion rate improves immediately, Quality Score improves over the following weeks, and CPCs fall as it does. One fix, three returns.' },
          { label: 'Rewrite the ads', correct: false, feedback: 'CTR is already strong, so the ads are working. The evidence points past the click.' },
          { label: 'Add more keywords', correct: false, feedback: 'More traffic to a page that is losing visitors multiplies the leak rather than fixing it.' },
        ],
      },
      {
        kind: 'teach', id: 'c3', title: 'Message match, concretely',
        blocks: [
          p('The simplest test anyone can run: does the **headline of the page** contain the words of the **search**? Not approximately — literally.'),
          p('Search "waterproof trail running shoes" → page headline "Waterproof Trail Running Shoes". The visitor gets a half-second confirmation that they are in the right place, and that confirmation is worth more than most design decisions.'),
          p('Ad copy is a promise. The landing page either keeps it in the first screenful or it does not.'),
        ],
      },
      {
        kind: 'truefalse', id: 'q3',
        statement: 'Landing page experience affects what you pay per click, not just conversion rate.',
        isTrue: true,
        explain: 'True, and it is why this lesson sits in an ads course rather than a web design one. Landing page experience is one of the three Quality Score components, Quality Score divides your CPC, so a better page lowers your cost per click as well as converting more of them.',
      },
      {
        kind: 'tip', id: 't1', title: 'Cheapest test available',
        text: 'Open your top five ad groups on a phone, on mobile data, and click your own ads. Not on your laptop on office wifi. Most landing page problems are obvious within ten seconds of doing this, and almost nobody does it.',
      },
    ],
  },
];
