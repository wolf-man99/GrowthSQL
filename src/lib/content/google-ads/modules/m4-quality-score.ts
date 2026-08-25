import type { GoogleLesson } from '../types';
import { p, list, key } from '../types';

/**
 * Module 4: Quality Score. The multiplier that decides what everything costs.
 *
 * Given its own module rather than a lesson inside Foundations because it is the
 * concept that most reliably separates a buyer who can improve an account from one
 * who can only raise bids. Everything here has to land as arithmetic the learner
 * can do, not as a Google talking point about "relevance".
 */
export const G4_LESSONS: GoogleLesson[] = [
  // ─────────────────────────────────────────────────────────── Lesson 4.1 ──
  {
    slug: 'quality-score-components',
    moduleSlug: 'quality-score',
    title: 'What Quality Score is made of',
    subtitle: 'Three components, one number, real money',
    minutes: 9,
    xp: 80,
    objective: 'Break a Quality Score into its parts and know which part to attack.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'One to ten, and it is a diagnostic', art: 'quality-score',
        blocks: [
          p('Quality Score is a 1–10 estimate of how relevant your keyword, ad and landing page are to a searcher. It is reported per keyword, and it is built from three components you can see individually:'),
          list([
            '**Expected CTR** — will people click this ad, given this search? Weighted most heavily.',
            '**Ad relevance** — does the ad match the intent of the keyword?',
            '**Landing page experience** — does the page deliver what the ad promised?',
          ]),
          p('Each is reported as Below average, Average or Above average — which is far more useful than the headline number, because it tells you which one to fix.'),
          key('Do not optimise "Quality Score". Optimise whichever of the three says Below average. The headline number is a summary, not a task.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'A keyword has Quality Score 4: expected CTR Below average, ad relevance Average, landing page Above average. Where do you start?',
        options: [
          'Rewrite the landing page',
          'Raise the bid',
          'Rewrite the ads so they speak to this keyword directly',
          'Pause the keyword',
        ],
        answer: 2,
        explain: 'Expected CTR is the weakest component and the most heavily weighted one. It usually means the ad does not visibly answer the search — the fix is copy containing the keyword and its intent, not a bid change or a page rebuild that is already Above average.',
      },
      {
        kind: 'teach', id: 'c2', title: 'What it is worth, in rupees',
        blocks: [
          p('Quality Score is not a vanity metric. It sits in the denominator of what you pay.'),
          p('Your CPC is roughly the Ad Rank of the advertiser below you, divided by your Quality Score. Double your Quality Score and, all else equal, you halve your cost per click — while simultaneously ranking higher.'),
          list([
            'QS 3 → paying a substantial premium on every single click.',
            'QS 7 → around the point where costs feel normal.',
            'QS 10 → paying materially less than competitors for the same position.',
          ]),
        ],
      },
      {
        kind: 'calc', id: 'calc1', variant: 'ad-rank',
        title: 'What Quality Score is worth',
        blurb: 'Hold the bid steady and move Quality Score. Watch position and actual CPC move together.',
      },
      {
        kind: 'truefalse', id: 'q2',
        statement: 'Raising your bid improves Quality Score, because your ad shows more often.',
        isTrue: false,
        explain: 'False, and it is a common and expensive belief. Quality Score measures relevance, not spend. Bidding more buys position at a higher price; it does nothing to make the ad more relevant. The causation runs the other way: better quality lowers what a position costs.',
      },
      {
        kind: 'teach', id: 'c3', title: 'The things that actually move it',
        blocks: [
          list([
            '**Tighter ad groups.** Fewer keywords per group means ads that genuinely answer all of them.',
            '**The keyword in the ad.** Bluntly. Google bolds matched terms and searchers scan for their own words.',
            '**Matched landing pages.** Ad group → its own category page, not the homepage.',
            '**Negatives.** Removing irrelevant queries lifts CTR on the ones that remain.',
            '**Time.** Quality Score reflects accumulated history, so changes take days to weeks to show.',
          ]),
          p('Note what is not on that list: bids, budget, and campaign type. Quality Score responds to relevance work and nothing else.'),
        ],
      },
      {
        kind: 'scenario', id: 'q3',
        situation: 'One ad group holds 60 keywords spanning shoes, socks and bags. Every keyword shows Quality Score 3–4, all with ad relevance Below average.',
        options: [
          { label: 'Write better ad copy for the group', correct: false, feedback: 'No single ad can be relevant to shoes, socks and bags at once. However good the copy, it will be a compromise for at least two of the three themes.' },
          { label: 'Split into three ad groups by theme, each with its own ads and landing page', correct: true, feedback: 'Right. Ad relevance is Below average because the ads structurally cannot match the keywords. Splitting is not tidiness — it is the only change that lets an ad be relevant, and Quality Score follows within a couple of weeks.' },
          { label: 'Raise bids to compensate', correct: false, feedback: 'Paying a permanent premium to work around a structural problem you could fix in an afternoon.' },
          { label: 'Move to broad match', correct: false, feedback: 'That widens the range of queries the same over-broad ads must answer, so relevance gets worse rather than better.' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 4.2 ──
  {
    slug: 'ad-rank-thresholds',
    moduleSlug: 'quality-score',
    title: 'When good ads do not show at all',
    subtitle: 'Ad Rank thresholds and the eligibility floor',
    minutes: 8,
    xp: 70,
    objective: 'Diagnose an ad that is eligible but not serving, and tell that apart from simply being outbid.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Winning is not the only bar',
        blocks: [
          p('Ranking above your competitors is not sufficient. Google also sets **Ad Rank thresholds**: minimum quality-weighted scores an ad must clear to show at all, and higher ones to show above the organic results.'),
          p('This is why an ad can be the only advertiser on a keyword and still not appear. There is nobody to outrank, and it is still below the floor.'),
          key('Two different failures look identical in the interface: losing to a competitor, and failing to clear the floor. They have opposite fixes.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'You are the only advertiser bidding on a keyword, and your ad still does not show. Why?',
        options: [
          'A bug',
          'Your Ad Rank is below the threshold to show at all',
          'The keyword has no volume',
          'Your budget ran out',
        ],
        answer: 1,
        explain: 'Thresholds are absolute, not relative. With no competitors there is nothing to outrank, but Google still refuses to show an ad it judges too poor or too poorly matched. The fix is quality or bid, not competition.',
      },
      {
        kind: 'teach', id: 'c2', title: 'Thresholds move with context',
        blocks: [
          p('The floor is not one number. It rises and falls with:'),
          list([
            '**The query\'s intent** — commercial searches carry lower thresholds than sensitive or informational ones.',
            '**Where on the page** — showing above the organic results demands a much higher rank than showing below them.',
            '**The searcher\'s context** — location, device, time of day.',
            '**What else is available** — a thin auction can raise the bar rather than lower it.',
          ]),
          p('So the same ad can show for one searcher and not another, on the same keyword, in the same hour.'),
        ],
      },
      {
        kind: 'scenario', id: 'q2',
        situation: 'A keyword shows "Rarely shown due to low Quality Score" in the status column.',
        options: [
          { label: 'Raise the bid until it shows', correct: false, feedback: 'It can work, and it is the expensive route: you are buying your way over a threshold that better relevance would lower. You will pay that premium on every click indefinitely.' },
          { label: 'Move the keyword to a tighter ad group with ads that match it and a matching landing page', correct: true, feedback: 'Right. The status names the cause. Fixing relevance both lowers the effective threshold and cuts the CPC once it does show — a bid increase does neither.' },
          { label: 'Delete the keyword', correct: false, feedback: 'Reasonable if the keyword is genuinely off-theme. If it is core to the business, it is worth the structural fix.' },
          { label: 'Switch to broad match', correct: false, feedback: 'Match type does not address a quality threshold; it widens what the same struggling ads have to answer.' },
        ],
      },
      {
        kind: 'truefalse', id: 'q3',
        statement: 'A high enough bid can always overcome a low Quality Score.',
        isTrue: false,
        explain: 'False. Below a certain quality, Google will not show the ad at any bid — the threshold is a floor, not a slope. And well before that point, the bid required is more than the click could ever be worth.',
      },
      {
        kind: 'tip', id: 't1', title: 'Read the status column',
        text: 'Google tells you plainly why a keyword is not serving: "Below first page bid", "Rarely shown due to low Quality Score", "Low search volume". Three different problems with three different fixes. Most people never look at the column and guess instead.',
      },
    ],
  },
];
