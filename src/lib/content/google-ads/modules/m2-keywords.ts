import type { GoogleLesson } from '../types';
import { p, list, key } from '../types';

/**
 * Module 2: Keywords & intent. The targeting layer, and the one place where
 * Google Ads accounts most reliably leak money.
 *
 * The central idea the module keeps returning to: a keyword is not what you show
 * for, it is a *rule about* what you show for. Learners who never internalise that
 * distinction spend years reading the keyword report and wondering why the numbers
 * disagree with reality.
 */
export const G2_LESSONS: GoogleLesson[] = [
  // ─────────────────────────────────────────────────────────── Lesson 2.1 ──
  {
    slug: 'match-types',
    moduleSlug: 'keywords',
    title: 'Match types',
    subtitle: 'Broad, phrase, exact, and what each really means now',
    minutes: 10,
    xp: 80,
    objective: 'Choose a match type deliberately, and predict what each one will actually match.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Three settings, one dial', art: 'match-types',
        blocks: [
          p('A keyword is a rule about which searches your ad may enter the auction for. The match type sets how loose that rule is.'),
          list([
            '**Broad match** — `running shoes`. Matches anything Google judges related: "jogging trainers", "best sneakers for marathon", sometimes "athletic wear".',
            '**Phrase match** — `"running shoes"`. Matches searches that include the *meaning* of the phrase: "buy running shoes online", "womens running shoes".',
            '**Exact match** — `[running shoes]`. Matches that search and close variants: "running shoe", "shoes for running".',
          ]),
          key('Broad reaches most and controls least. Exact controls most and reaches least. Neither end is correct by default; the right answer depends on how much conversion data you have to steer with.'),
        ],
      },
      {
        kind: 'teach', id: 'c2', title: 'The thing everyone gets wrong about exact match',
        blocks: [
          p('"Exact" has not meant *exactly that string* since 2018. Google matches close variants: plurals, misspellings, reordering, and words it considers to have the same intent.'),
          p('`[running shoes]` can serve "running sneakers". That is usually helpful, and occasionally infuriating — and it is the reason you still have to read your search terms report even on an all-exact account.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'Which match type is most likely to show your ad for "how to clean running shoes"?',
        options: ['Exact [running shoes]', 'Phrase "running shoes"', 'Broad running shoes', 'All three equally'],
        answer: 2,
        explain: 'Broad match casts widest and will happily match informational queries around the theme. Phrase would need the meaning of "running shoes" to be present in a matching sense, and exact is anchored to the purchase intent. Broad is where research traffic sneaks in.',
      },
      {
        kind: 'teach', id: 'c3', title: 'Broad match is not what it was',
        blocks: [
          p('Broad match used to be a wrecking ball, and its reputation among older buyers is still built on that. It has changed: modern broad match uses the searcher\'s context, your landing page, your other keywords and your account\'s conversion history to judge relevance.'),
          p('With good conversion tracking and Smart Bidding, broad match now finds converting queries you would never have thought to add. Without them, it still spends your budget on curiosity.'),
          key('Broad match is a bet on your conversion signal. Strong signal, it works. No signal, it is exactly as bad as its reputation.'),
        ],
      },
      {
        kind: 'scenario', id: 'q2',
        situation: 'A brand new account with no conversion tracking wants maximum reach quickly. The interface suggests broad match. What should you do?',
        options: [
          { label: 'Use broad match — reach is the goal', correct: false, feedback: 'Broad match steers using conversion data. With none, there is nothing steering it, and it will find the cheapest clicks rather than the best ones.' },
          { label: 'Start with phrase and exact, get conversion tracking working, then test broad', correct: true, feedback: 'Right. Tighter match types keep spend on defensible queries while the account accumulates the signal broad match needs. Then broad becomes an expansion tool rather than a gamble.' },
          { label: 'Use exact only, permanently', correct: false, feedback: 'Safe, and it caps you at the queries you personally thought of. Fine to start; a ceiling if you stay there.' },
        ],
      },
      {
        kind: 'sort', id: 'q3',
        prompt: 'Order these from tightest control to loosest.',
        items: ['Exact [running shoes]', 'Phrase "running shoes"', 'Broad running shoes'],
        explain: 'Exact anchors to the query and its close variants, phrase requires the meaning to be present, broad matches anything Google judges related. Control and reach trade off directly against each other.',
      },
      {
        kind: 'tip', id: 't1', title: 'A structure that ages well',
        text: 'Exact match on the queries you know convert, with the budget confidence to bid properly. Phrase for the variations around them. Broad in its own campaign, with its own budget and a hard negative list, so when it wanders you can see the cost in isolation rather than hidden inside a good campaign.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 2.2 ──
  {
    slug: 'search-terms',
    moduleSlug: 'keywords',
    title: 'Keywords are not search terms',
    subtitle: 'The single most useful report in the account',
    minutes: 9,
    xp: 70,
    objective: 'Read the search terms report and act on it, rather than trusting the keyword report alone.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Two different things with confusingly similar names', art: 'search-terms',
        blocks: [
          p('A **keyword** is what you bid on. A **search term** is what somebody actually typed. They are not the same, and the gap between them is where money goes missing.'),
          p('You add `running shoes` as a keyword. Google matches it to "cheap running shoes", "running shoes for flat feet", "running shoes wiki", "who invented running shoes". Your keyword report shows one row. Your search terms report shows what really happened.'),
          key('The keyword report tells you what you asked for. The search terms report tells you what you bought. Only one of those is reality.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'Your keyword `office chair` has a 1.2% conversion rate. Where do you look first to understand why?',
        options: [
          'The ad copy',
          'The search terms report',
          'The landing page',
          'The bid',
        ],
        answer: 1,
        explain: 'A single keyword row is an average across every query it matched. That 1.2% might be 8% on "buy office chair" and 0.1% on "office chair repair". Until you split the term from the keyword you are optimising a blended number that describes nothing.',
      },
      {
        kind: 'teach', id: 'c2', title: 'What to do with what you find',
        blocks: [
          p('Every search term you read falls into one of three buckets, and each has an action:'),
          list([
            '**Converting and not yet a keyword** → add it as exact match, so you can bid on it deliberately.',
            '**Irrelevant** → add it as a negative, so you never pay for it again.',
            '**Relevant but not converting** → leave it and watch. One click is not evidence.',
          ]),
          p('That loop, run weekly, is most of what day-to-day Search management actually is.'),
        ],
      },
      {
        kind: 'scenario', id: 'q2',
        situation: 'The search terms report shows "running shoes repair near me" got 40 clicks and no conversions. You do not offer repairs.',
        options: [
          { label: 'Add "repair" as a negative keyword', correct: true, feedback: 'Right, and negate the word rather than the phrase: "repair", "repairs" and "repairing" will all appear eventually, and one broad-match negative covers the theme.' },
          { label: 'Lower the bid on the matching keyword', correct: false, feedback: 'That reduces every query the keyword matches, including the ones converting well. You would be paying for the bad traffic by giving up the good.' },
          { label: 'Pause the keyword', correct: false, feedback: 'Too blunt. The keyword is presumably matching useful queries too — the problem is one specific theme, and negatives exist to remove exactly that.' },
          { label: 'Write ad copy saying you do not do repairs', correct: false, feedback: 'You would still be paying for the click. The point is to not enter the auction at all.' },
        ],
      },
      {
        kind: 'teach', id: 'c3', title: 'The part Google will not show you',
        blocks: [
          p('Since 2020 Google withholds search terms that were not searched by "a significant number of users", on privacy grounds. In practice a meaningful share of your spend appears against no visible term at all.'),
          p('This is worth knowing rather than raging about. It means your negative lists can never be complete, it means broad match carries permanent unseen risk, and it means the terms you *can* see deserve more attention, not less.'),
        ],
      },
      {
        kind: 'truefalse', id: 'q3',
        statement: 'If the search terms report shows no problem terms, there are no problem terms.',
        isTrue: false,
        explain: 'False. A share of queries is hidden for privacy reasons, and it is not a small one. The report is the best evidence you have, not complete evidence — which is an argument for tighter match types when the stakes are high.',
      },
      {
        kind: 'tip', id: 't1', title: 'Make it a habit, not a project',
        text: 'Fifteen minutes every Monday, sorted by cost descending, top 50 terms. Add negatives, promote winners, move on. Accounts that do this beat accounts that do not, and the gap compounds because negatives never expire.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 2.3 ──
  {
    slug: 'negative-keywords',
    moduleSlug: 'keywords',
    title: 'Negative keywords',
    subtitle: 'The cheapest optimisation in the account',
    minutes: 8,
    xp: 70,
    objective: 'Build negative lists that block waste without silently blocking revenue.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Saying no is a targeting decision',
        blocks: [
          p('A negative keyword stops your ad entering auctions for searches containing it. It is the only lever in the account that reduces spend without reducing the traffic you actually want.'),
          p('Negatives have their own match types, and they behave differently from positive ones:'),
          list([
            '**Broad negative** `free` — blocks any search containing "free" in any order.',
            '**Phrase negative** `"free trial"` — blocks searches containing that phrase.',
            '**Exact negative** `[free]` — blocks only the search "free" on its own.',
          ]),
          key('Negative broad match does NOT expand to synonyms or close variants. Negate "shoe" and "shoes" still runs. This asymmetry catches almost everyone once.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'You add the broad negative `cheap`. Which search is still eligible?',
        options: ['cheap running shoes', 'running shoes cheap', 'affordable running shoes', 'cheap shoes for running'],
        answer: 2,
        explain: '"Affordable" is a synonym, and negative keywords do not expand to synonyms — only positives do. If you want the whole price-sensitive theme out, every variant has to be listed: cheap, affordable, budget, discount, low cost.',
      },
      {
        kind: 'teach', id: 'c2', title: 'The themes worth blocking before you launch',
        blocks: [
          p('Most wasted spend in a new account falls into a handful of predictable buckets. Blocking them on day one is free:'),
          list([
            '**Free / DIY** — "free", "diy", "homemade", "how to make".',
            '**Employment** — "jobs", "career", "salary", "hiring", "internship".',
            '**Research** — "wikipedia", "meaning", "definition", "history of", "reddit".',
            '**Wrong commercial intent** — "repair", "used", "second hand", "rental", "wholesale".',
            '**Competitors** — unless you are bidding on them deliberately, which is its own decision.',
          ]),
        ],
      },
      {
        kind: 'scenario', id: 'q2',
        situation: 'A colleague adds the broad negative `shoe` to a shoe retailer\'s account to block "shoe repair" queries. What happens?',
        options: [
          { label: 'Only repair queries are blocked', correct: false, feedback: 'The negative is the single word "shoe", so it blocks every search containing it — which for a shoe retailer is nearly all of them.' },
          { label: 'Almost all traffic stops, because every relevant search contains "shoe"', correct: true, feedback: 'Exactly. The negative should have been "repair". This is the most common self-inflicted outage in Google Ads: a negative added in haste that shares a word with the entire business.' },
          { label: 'Nothing changes', correct: false, feedback: 'It changes a great deal. Broad negatives block any search containing the word.' },
          { label: 'Only exact "shoe" searches are blocked', correct: false, feedback: 'That would be the behaviour of an exact negative, [shoe]. This one is broad.' },
        ],
      },
      {
        kind: 'teach', id: 'c3', title: 'Lists, not one-offs',
        blocks: [
          p('Negatives added to a single campaign have to be added again to the next one, and the one after that. **Shared negative lists** are maintained once at account level and applied to every campaign that needs them.'),
          p('A structure that scales: one universal list (junk, jobs, free, research) applied everywhere, plus per-campaign negatives for the specific themes that campaign attracts.'),
        ],
      },
      {
        kind: 'truefalse', id: 'q3',
        statement: 'Negative keywords can also be used to stop two of your own campaigns competing for the same search.',
        isTrue: true,
        explain: 'True, and it is one of their most useful jobs. Negating your exact-match terms out of your broad-match campaign forces each query to the campaign you meant to handle it — the closest thing Search has to Meta\'s audience exclusions.',
      },
      {
        kind: 'tip', id: 't1', title: 'Read it back before you save',
        text: 'For every negative, ask: "which searches that I *want* contain this word?" Thirty seconds of that question prevents the outage in the scenario above, which typically runs for a day before anyone notices traffic has vanished.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 2.4 ──
  {
    slug: 'building-a-keyword-list',
    moduleSlug: 'keywords',
    title: 'Building the list',
    subtitle: 'Intent tiers, and where to start bidding',
    minutes: 9,
    xp: 70,
    objective: 'Sort keywords by commercial intent and spend the first budget where it pays back fastest.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Four tiers of intent',
        blocks: [
          p('Not all searches are worth the same, and the difference is not subtle. Sorting a keyword list by intent before bidding on any of it is the highest-leverage half hour in a new account.'),
          list([
            '**Transactional** — "buy running shoes online", "running shoes price". Ready now. Most expensive, best converting, start here.',
            '**Commercial** — "best running shoes", "nike vs adidas running". Comparing. Converts respectably, costs less.',
            '**Informational** — "how to choose running shoes". Learning. Cheap clicks, poor conversion, useful for remarketing.',
            '**Navigational** — "nike store", your own brand name. Someone looking for a specific business.',
          ]),
          key('A limited budget belongs at the transactional end. Informational traffic is a content strategy wearing an ads budget.'),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'A new account has ₹1,500/day. Which keyword set should take most of it?',
        options: [
          '"how to choose running shoes"',
          '"buy running shoes online"',
          '"running shoes history"',
          'Spread evenly across all three',
        ],
        answer: 1,
        explain: 'Transactional intent converts now, which is what a new account needs — both for revenue and because Smart Bidding cannot learn without conversions. Informational keywords are cheaper per click and far more expensive per conversion.',
      },
      {
        kind: 'teach', id: 'c2', title: 'Your own brand name: the argument nobody wins',
        blocks: [
          p('Should you bid on your own brand? Somebody searching "Northbound shoes" will probably find you anyway, so it can look like paying for a click you had for free.'),
          p('The case for bidding on it: competitors can and do bid on your brand, an ad occupies more of the page than an organic listing, and you control the message and the landing page. Brand keywords are also the cheapest clicks in the account, because your Quality Score on your own name is close to perfect.'),
          p('The case against: if nobody is bidding against you and your organic listing is strong, some of that spend genuinely is a tax on traffic you already had.'),
          key('The honest answer is to test it: pause brand for two weeks and watch total revenue, not just brand-campaign revenue. Most brands find they lose more than they save; some do not.'),
        ],
      },
      {
        kind: 'scenario', id: 'q2',
        situation: 'Brand keywords show a 14x ROAS. The client wants to move the whole budget into them.',
        options: [
          { label: 'Do it — 14x is the best performance in the account', correct: false, feedback: 'Brand ROAS is inflated by demand you already created. There is no more of it to buy: brand volume is capped by how many people already know you, so the budget would simply fail to spend.' },
          { label: 'Explain that brand ROAS is capped by existing demand, and that non-brand is what creates future brand searches', correct: true, feedback: 'Right. Brand captures demand other activity generated. Fund it fully — it is cheap — then spend the rest on the non-brand terms that make new people search for you next month.' },
          { label: 'Move half', correct: false, feedback: 'Same problem in smaller units. The constraint is search volume, not budget.' },
        ],
      },
      {
        kind: 'teach', id: 'c3', title: 'Where the list comes from',
        blocks: [
          p('Four sources, in the order they are actually useful:'),
          list([
            'Your own **search terms report**, if the account has any history. Real queries beat estimated ones.',
            '**Keyword Planner** for volume and competition, treating its numbers as broad ranges rather than facts.',
            'Google\'s own **autocomplete and "people also ask"**, which is free qualitative research into how customers phrase things.',
            'Your **site search** and support tickets — the words customers use rather than the words you use.',
          ]),
          p('That last one matters more than it sounds. Businesses describe themselves in industry language; customers search in plain language, and the gap is often where the cheap volume is.'),
        ],
      },
      {
        kind: 'tip', id: 't1', title: 'Start narrow',
        text: 'Twenty keywords you are confident about will teach you more in a fortnight than four hundred you guessed at. You can always add; every keyword you add before you have evidence is a keyword you will later have to audit.',
      },
    ],
  },
];
