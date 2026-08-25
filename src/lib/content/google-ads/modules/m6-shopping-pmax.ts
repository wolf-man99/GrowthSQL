import type { GoogleLesson } from '../types';
import { p, list, key } from '../types';

/**
 * Module 6: Shopping & Performance Max. Where retail money actually goes.
 *
 * Written to resist the two opposite pieces of received wisdom: that PMax is a
 * black box to be avoided, and that it is the answer to everything. Both are
 * positions rather than analyses. What a learner needs is the ability to say what
 * it can and cannot see, and to decide from that.
 */
export const G6_LESSONS: GoogleLesson[] = [
  // ─────────────────────────────────────────────────────────── Lesson 6.1 ──
  {
    slug: 'shopping-and-the-feed',
    moduleSlug: 'shopping',
    title: 'Shopping starts in the feed',
    subtitle: 'Merchant Center, and why the title is the keyword',
    minutes: 10,
    xp: 80,
    objective: 'Explain why feed quality is Shopping\'s equivalent of keyword research, and fix a weak product title.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'There are no keywords in Shopping', art: 'shopping-flow',
        blocks: [
          p('Shopping ads have no keywords. You do not tell Google which searches to match — it reads your **product feed** and decides for itself.'),
          p('The feed lives in **Merchant Center** and carries title, description, price, availability, images, GTIN, brand and product type for every SKU. Google matches queries against that data.'),
          key('In Search you write keywords. In Shopping your product titles *are* the keywords. That is the whole mental shift, and it is why feed work outperforms campaign work in most Shopping accounts.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'Which product title will match more high-intent searches?',
        options: [
          'NB-7734-BLK',
          'Northbound Trail Runner',
          'Northbound Trail Runner Mens Waterproof Trail Running Shoes Black Size 9',
          'Best Running Shoes Ever!!!',
        ],
        answer: 2,
        explain: 'The third contains brand, gender, key attribute, product type and size — the words people actually search. The SKU matches nothing, the short title misses most modifiers, and the fourth is promotional language nobody searches for and Merchant Center may disapprove.',
      },
      {
        kind: 'teach', id: 'c2', title: 'A title formula that works',
        blocks: [
          p('Google gives you 150 characters and shows roughly the first 70. Front-load accordingly:'),
          list([
            '**Brand + Product Type + Key Attribute + Colour + Size**, for apparel and footwear.',
            '**Brand + Model + Spec + Product Type**, for electronics.',
          ]),
          p('Concretely: "Northbound Trail Runner Mens Waterproof Trail Running Shoes — Black, Size 9".'),
          p('Everything else in the feed supports this. Product type and Google product category improve categorisation, GTINs make you eligible for more surfaces, and the image is what actually earns the click.'),
        ],
      },
      {
        kind: 'teach', id: 'c3', title: 'The feed problems that quietly cost the most',
        blocks: [
          list([
            '**Disapprovals** — a disapproved product simply does not exist as far as Shopping is concerned. Check the diagnostics tab weekly.',
            '**Price and availability mismatch** — the price in the feed must match the landing page. Mismatches get products suspended, sometimes the whole account.',
            '**Missing GTINs** — reduces eligibility across surfaces.',
            '**One poor image** — Shopping is a visual format; a bad photo loses the click regardless of everything else.',
            '**Stale stock status** — advertising things you cannot sell.',
          ]),
          p('None of these appear in the Google Ads interface. A campaign can look perfectly healthy while a third of the catalogue is invisible.'),
        ],
      },
      {
        kind: 'truefalse', id: 'q2',
        statement: 'You can add negative keywords to a Shopping campaign.',
        isTrue: true,
        explain: 'True, and it is your main steering lever. You cannot choose which searches to match, but you can exclude ones you do not want — which makes negatives more important in Shopping than in Search, not less.',
      },
      {
        kind: 'scenario', id: 'q3',
        situation: 'A Shopping campaign spends steadily with poor ROAS. The search terms report shows generic queries like "shoes" and "trainers".',
        options: [
          { label: 'Lower bids across the board', correct: false, feedback: 'It reduces everything proportionally, including the specific high-intent queries that are working.' },
          { label: 'Add generic single-word terms as negatives and enrich titles with the specific attributes people search', correct: true, feedback: 'Right, both halves. Negatives stop the broad low-intent traffic now; better titles pull in specific queries that convert. In Shopping, feed work is optimisation work.' },
          { label: 'Increase the budget to get more data', correct: false, feedback: 'Buying more of a known-unprofitable traffic mix.' },
          { label: 'Switch to Performance Max', correct: false, feedback: 'PMax runs on the same feed. A weak feed produces weak PMax, with less visibility into why.' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 6.2 ──
  {
    slug: 'performance-max',
    moduleSlug: 'shopping',
    title: 'Performance Max, honestly',
    subtitle: 'What it does, what it hides, and when to use it',
    minutes: 11,
    xp: 90,
    objective: 'Decide whether PMax is right for an account, and structure it so its results can still be read.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'One campaign, every surface', art: 'pmax-structure',
        blocks: [
          p('Performance Max spans Search, Shopping, Display, YouTube, Gmail, Discover and Maps from a single campaign. You supply a budget, a conversion goal, asset groups and optional audience signals. Google decides everything else.'),
          list([
            '**Asset group** — headlines, descriptions, images, video, logos: roughly an ad group.',
            '**Listing group** — which products from the feed this asset group covers.',
            '**Audience signal** — a hint about who converts, not a targeting restriction. Google will go outside it.',
          ]),
          key('An audience signal is a suggestion, not a boundary. Buyers who read it as targeting are consistently surprised by where their money goes.'),
        ],
      },
      {
        kind: 'teach', id: 'c2', title: 'What it genuinely does well',
        blocks: [
          list([
            'Finds converting queries and placements no human would have listed.',
            'Handles very large catalogues without per-product campaign work.',
            'Fills demand beyond what Search alone can capture.',
            'Improves as conversion volume grows — it is genuinely data-hungry rather than merely automated.',
          ]),
          p('For a retailer with a healthy feed, solid conversion values and existing Search coverage, PMax frequently outperforms the Shopping campaign it replaced. That is not marketing copy; it is the common outcome.'),
        ],
      },
      {
        kind: 'teach', id: 'c3', title: 'What it hides',
        blocks: [
          list([
            '**Most search terms.** You see a fraction of the queries you paid for.',
            '**The channel split.** Search, Display and YouTube performance are blended into one number.',
            '**Placement control.** No exclusions beyond a limited brand list and content settings.',
            '**Why anything happened.** When performance moves, the levers to investigate with are largely absent.',
          ]),
          p('The practical consequence: PMax can cannibalise your existing Search and Shopping campaigns, take credit for conversions they would have won anyway, and give you no clean way to prove it either way.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'You launch PMax alongside an existing branded Search campaign. Brand Search volume drops sharply and PMax conversions rise. What most likely happened?',
        options: [
          'PMax found new customers',
          'PMax absorbed brand searches the Search campaign was already winning',
          'Brand demand fell',
          'The Search campaign broke',
        ],
        answer: 1,
        explain: 'PMax will happily serve on brand queries, which are the cheapest and best-converting traffic in any account. It reports them as its own wins. Total conversions barely moved; the attribution did. Excluding brand terms from PMax makes the comparison honest.',
      },
      {
        kind: 'teach', id: 'c4', title: 'Structuring it so it stays readable',
        blocks: [
          list([
            '**Exclude brand terms** with an account-level negative list, so PMax cannot claim traffic you already own.',
            '**Separate asset groups by margin or category**, so a low-margin line cannot hide behind a high-margin one.',
            '**Feed the audience signal your real customer data** — existing purchasers, high-value visitors. A weak signal means a slower, more expensive start.',
            '**Give it real assets.** Missing video means Google generates one, and its version is usually worse than yours.',
            '**Hold it for at least six weeks.** Judging PMax in week two is judging its learning period.',
          ]),
        ],
      },
      {
        kind: 'scenario', id: 'q2',
        situation: 'A client with a 6,000-SKU catalogue, working conversion tracking with values, and a mature Search account wants to try PMax.',
        options: [
          { label: 'Replace everything with PMax', correct: false, feedback: 'Throwing away a mature Search account with visible search terms in favour of a campaign you cannot see into. Even if it works, you lose the ability to know why.' },
          { label: 'Run PMax alongside Search, with brand excluded, and judge on total account profit rather than PMax\'s own numbers', correct: true, feedback: 'Right. The catalogue size and conversion values make it a genuinely good fit, and brand exclusion plus an account-level view is what stops it looking better than it is.' },
          { label: 'Wait until Google adds more reporting', correct: false, feedback: 'A reasonable instinct that costs you the growth in the meantime. The reporting gaps are real but manageable with structure.' },
          { label: 'Use PMax only for the lowest-margin products', correct: false, feedback: 'Backwards. Value-based bidding needs products worth optimising toward; starting with the thinnest margins gives it the least to work with.' },
        ],
      },
      {
        kind: 'truefalse', id: 'q3',
        statement: 'An audience signal in Performance Max restricts who your ads can reach.',
        isTrue: false,
        explain: 'False, and this catches almost everyone once. A signal tells Google where to start looking; it will expand well beyond it whenever it predicts a conversion. Genuine restriction comes from exclusions and feed scope, not from signals.',
      },
    ],
  },
];
