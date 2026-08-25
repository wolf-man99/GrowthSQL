import type { GoogleLesson } from '../types';
import { p, list, key } from '../types';

/**
 * Module 7: Optimising & scaling. The weekly loop, and where growth comes from
 * once the obvious wins are gone.
 *
 * Ends the beginner-to-intermediate arc deliberately. Portfolio strategies,
 * scripts, data-driven attribution modelling and the API are the advanced course;
 * what a learner needs here is a routine they can run every week and a clear map of
 * the four directions an account can grow in.
 */
export const G7_LESSONS: GoogleLesson[] = [
  // ─────────────────────────────────────────────────────────── Lesson 7.1 ──
  {
    slug: 'the-weekly-loop',
    moduleSlug: 'optimising',
    title: 'The weekly optimisation loop',
    subtitle: 'What good management actually looks like',
    minutes: 10,
    xp: 80,
    objective: 'Run a repeatable weekly routine, and resist the changes that feel productive but reset learning.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Four steps, in this order', art: 'optimisation-loop',
        blocks: [
          p('Day-to-day Search management is not a series of clever interventions. It is one loop, run consistently:'),
          list([
            '**Mine** — read the search terms report, sorted by cost.',
            '**Negate** — block the themes that will never convert.',
            '**Promote** — pull converting terms out as their own exact-match keywords.',
            '**Refine** — adjust bids, targets or budgets where the evidence is genuinely sufficient.',
          ], true),
          key('Steps one and two are where most of the money is. They are also the least interesting, which is why most accounts skip them.'),
        ],
      },
      {
        kind: 'teach', id: 'c2', title: 'How much evidence is enough',
        blocks: [
          p('The most expensive habit in paid search is acting on noise. A keyword with 12 clicks and no conversions has told you almost nothing — at a 3% conversion rate you would expect zero conversions from 12 clicks most of the time.'),
          list([
            '**Pausing a keyword** — wait for roughly 3x your target CPA in spend with nothing to show.',
            '**Judging an ad** — a few hundred impressions each, minimum, and preferably a full week.',
            '**Moving a bid target** — two weeks of stable data, then a 10–20% step.',
          ]),
          p('The discipline is to write down what evidence you need *before* you look, so the decision is not made by whichever number happens to catch your eye.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'A keyword has 12 clicks, no conversions, and target CPA is ₹800. Total spend is ₹340. What now?',
        options: [
          'Pause it — it does not convert',
          'Leave it, there is not enough data yet',
          'Double the bid to get more data faster',
          'Move it to broad match',
        ],
        answer: 1,
        explain: 'At ₹340 spent against an ₹800 target CPA, you have not yet paid for a single expected conversion. Pausing here throws away keywords on the strength of ordinary variance — one of the most common ways a decent account is slowly shrunk.',
      },
      {
        kind: 'teach', id: 'c3', title: 'The adjustments that still matter',
        blocks: [
          p('Smart Bidding handles most of what manual bid adjustments used to do, but several still earn their place:'),
          list([
            '**Location** — genuinely different performance by city or state, especially where delivery cost or competition differs.',
            '**Schedule** — B2B accounts converting only in business hours; support-dependent purchases that stall overnight.',
            '**Device** — usually best left to Smart Bidding, but worth checking when mobile conversion rate collapses for a fixable reason.',
            '**Audience observation** — layer remarketing lists as observation, not targeting, and read the difference before acting.',
          ]),
        ],
      },
      {
        kind: 'scenario', id: 'q2',
        situation: 'A campaign has been on Target ROAS for three weeks and performance is stable. A colleague suggests pausing the bottom 20% of keywords, rewriting all ads, and lowering the target — this week.',
        options: [
          { label: 'Do all three, they are all improvements', correct: false, feedback: 'Three simultaneous changes reset learning and make the result uninterpretable. If performance moves, you will not know which one did it — or whether it was the learning period.' },
          { label: 'Do one, wait two weeks, then reassess', correct: true, feedback: 'Right. Sequence them and each becomes a readable experiment. Start with negatives and pauses, since those do not disturb bidding, and leave target changes for last.' },
          { label: 'Do none — it is stable', correct: false, feedback: 'Stability is a good place to improve from, not a reason to stop. The problem is the batch, not the ambition.' },
          { label: 'Rewrite the ads only, since creative is safest', correct: false, feedback: 'Defensible, but new ads also need time to accumulate data, and the ads were not identified as the weak point.' },
        ],
      },
      {
        kind: 'truefalse', id: 'q3',
        statement: 'Making several optimisations at once is efficient, because you improve the account faster.',
        isTrue: false,
        explain: 'False. Batched changes destroy attribution and restart learning. You may well end up better off, and you will not know what to repeat or what to undo — so the next decision is guesswork too. The cost compounds.',
      },
      {
        kind: 'tip', id: 't1', title: 'Keep a change log',
        text: 'Date, what changed, why, what you expected. Fifteen seconds per entry. Six weeks later, when performance has drifted, it is the difference between a diagnosis and a shrug — and it is the single habit that most reliably separates people who improve accounts from people who merely operate them.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 7.2 ──
  {
    slug: 'scaling-search',
    moduleSlug: 'optimising',
    title: 'Four directions to grow',
    subtitle: 'When the obvious wins are gone',
    minutes: 10,
    xp: 90,
    objective: 'Choose the right growth direction for an account\'s actual constraint.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Growth is not one thing',
        blocks: [
          p('Once a Search account is profitable, there are exactly four directions to grow, and the right one depends entirely on which constraint is binding.'),
          list([
            '**Deeper** — win more of the auctions you already qualify for. Fix impression share lost to budget or rank.',
            '**Wider** — more keywords, looser match types, more of the query space.',
            '**Sideways** — new campaign types: Shopping, PMax, Demand Gen.',
            '**Looser** — accept a lower ROAS target for more volume, if the unit economics allow.',
          ]),
          key('Diagnose before choosing. An account losing 60% of impressions to budget does not need more keywords; it needs money.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'Impression share is 91%, ROAS is comfortably above break-even, and the budget is not exhausted. Which direction?',
        options: [
          'Deeper — raise bids',
          'Wider or sideways — you have nearly exhausted this keyword set',
          'Looser — lower the ROAS target',
          'Nothing, it is working',
        ],
        answer: 1,
        explain: 'At 91% impression share there is almost nothing left to win on these keywords, and the budget is not the constraint either. Growth has to come from new query space or new surfaces — the classic point at which Shopping or PMax genuinely earns its place.',
      },
      {
        kind: 'teach', id: 'c2', title: 'The ROAS-versus-volume trade, stated plainly',
        blocks: [
          p('A tighter target means fewer auctions qualify, so less spend and less revenue at a higher ratio. A looser target means more of everything at a lower ratio. Neither is automatically better, and the ratio alone cannot tell you which.'),
          p('Worked through: at 500% ROAS you might spend ₹1,00,000 for ₹5,00,000 revenue. At 350% you might spend ₹3,00,000 for ₹10,50,000. The ratio is worse and the business is much larger. Whether that is an improvement depends on your margin, not on the percentage.'),
          key('Optimise total profit, not ROAS. ROAS is a constraint you choose; profit is the outcome you are actually after.'),
        ],
      },
      {
        kind: 'calc', id: 'calc1', variant: 'breakeven-cpc',
        title: 'How low can the target go?',
        blurb: 'Margin sets the floor. Below break-even, more volume simply loses money faster.',
      },
      {
        kind: 'scenario', id: 'q2',
        situation: 'A client at 600% ROAS wants to double revenue. Break-even is 250%.',
        options: [
          { label: 'Lower the target in steps toward 400%, watching total profit at each step', correct: true, feedback: 'Right. There is a wide gap between 600% and the 250% floor, and every point of it is profitable volume being left unbought. Step down gradually so Smart Bidding re-learns cleanly, and stop where total profit stops rising.' },
          { label: 'Keep 600% and triple the budget', correct: false, feedback: 'The target is the binding constraint, not the budget. At 600% Google only bids on auctions it thinks will clear it, so the extra budget goes unspent.' },
          { label: 'Drop straight to 250%', correct: false, feedback: 'Break-even means zero profit. You want to approach it, not land on it — and a jump that large forces a disruptive re-learn.' },
          { label: 'Add Display to increase reach', correct: false, feedback: 'Low-intent reach for a business that has not yet bought the profitable high-intent demand sitting in front of it.' },
        ],
      },
      {
        kind: 'teach', id: 'c3', title: 'Where this course stops',
        blocks: [
          p('You can now structure an account, choose match types deliberately, read search terms and act on them, diagnose Quality Score, pick a bidding strategy that matches your data, run Shopping and Performance Max with your eyes open, and grow an account in the right direction for its actual constraint.'),
          p('That is a working intermediate media buyer. What sits beyond it — portfolio bid strategies, scripts and automated rules, data-driven attribution, incrementality testing, the API, and cross-channel budget allocation — is a separate course, because each needs volume and context that this one deliberately did not assume.'),
        ],
      },
      {
        kind: 'truefalse', id: 'q3',
        statement: 'An account with 95% impression share and profitable ROAS should raise bids to grow.',
        isTrue: false,
        explain: 'False. At 95% there is essentially nothing left to win, so higher bids buy the last few percent at a steep premium and raise the cost of everything you were already winning. Growth from here comes from new keywords, new campaign types, or a looser target.',
      },
    ],
  },
];
