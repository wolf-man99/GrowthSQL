import type { GoogleLesson } from '../types';
import { p, list, key } from '../types';

/**
 * Module 1: Foundations. What Google Ads is, and why a Meta buyer's instincts
 * mislead them here.
 *
 * The whole module is built around one correction. On Meta you choose who sees an
 * ad; on Google the searcher chooses you. Every downstream difference — keywords
 * instead of audiences, Quality Score instead of creative fatigue, negative lists
 * instead of exclusion audiences — falls out of that single reversal, so it is
 * worth spending a lesson on before anything else.
 */
export const G1_LESSONS: GoogleLesson[] = [
  // ─────────────────────────────────────────────────────────── Lesson 1.1 ──
  {
    slug: 'intent-vs-interruption',
    moduleSlug: 'foundations',
    title: 'Intent, not interruption',
    subtitle: 'Why Google is a different job from Meta',
    minutes: 8,
    xp: 60,
    objective: 'Explain what Google Ads is actually buying, and why demand capture and demand creation need different playbooks.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Somebody already wants this', art: 'intent-vs-interruption',
        blocks: [
          p('On Meta you interrupt. Somebody is scrolling through photos of their friends, and your ad appears whether or not they had any interest in buying today. Your job is to *create* demand: stop the scroll, make the case, earn the click.'),
          p('On Google, somebody typed **"running shoes for flat feet"** into a search box. They are not being interrupted. They have a problem and they are actively looking for the answer. Your job is to *capture* demand that already exists.'),
          key('Meta finds people for your product. Google puts your product in front of people already looking for it. Same money, opposite motion.'),
        ],
      },
      {
        kind: 'teach', id: 'c2', title: 'What that changes in practice',
        blocks: [
          p('This is not a philosophical distinction. It changes the levers you pull:'),
          list([
            '**Targeting is a query, not a person.** You bid on what somebody typed, not on who they are.',
            '**Creative matters less, relevance matters more.** A brilliant video will not save an ad that answers the wrong question.',
            '**Volume is capped by demand.** Meta can always show your ad to more people. Google cannot make more people search.',
            '**Intent is priced in.** "buy running shoes online" costs many times more than "are running shoes good for you" — and it is usually worth it.',
          ]),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'A brand doubles its Google Search budget and spend barely moves. What is the most likely reason?',
        options: [
          'The ads are not good enough',
          'There is only so much search volume for those keywords',
          'The bidding strategy is broken',
          'Quality Score is too low',
        ],
        answer: 1,
        explain: 'Search is demand capture, so spend is capped by how many people are actually searching. Doubling the budget on a keyword set that is already showing for nearly every eligible query has nothing to buy. This is the single biggest structural difference from Meta, where more budget almost always finds more people.',
      },
      {
        kind: 'teach', id: 'c3', title: 'The trap this sets for paid social buyers',
        blocks: [
          p('A media buyer arriving from Meta usually makes the same three mistakes in their first month:'),
          list([
            'They write clever, emotive ad copy — where Google rewards copy that repeats the searcher\'s own words back to them.',
            'They chase cheap clicks, and end up buying research traffic instead of buying intent.',
            'They ignore search terms for weeks, and quietly pay for hundreds of queries they would never have chosen.',
          ]),
          p('None of these are stupid. They are all correct instincts on a platform where you pick the audience. They are simply the wrong instincts here.'),
        ],
      },
      {
        kind: 'truefalse', id: 'q2',
        statement: 'Because Google searchers have high intent, Search campaigns generally convert at a higher rate than cold Meta prospecting.',
        isTrue: true,
        explain: 'True, and it is why Search CPCs are so much higher. You are paying a premium for someone already in the market. The corollary matters too: high conversion rate does not mean high profit, because you paid up front for that intent.',
      },
      {
        kind: 'tip', id: 't1', title: 'Where each one earns its place',
        text: 'Most healthy accounts run both. Google captures the demand that already exists — the floor. Meta creates demand that would not have existed — the growth. A brand running only Search is limited to the size of its category; a brand running only Meta is leaving its warmest buyers to a competitor\'s ad on their own brand name.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 1.2 ──
  {
    slug: 'account-structure',
    moduleSlug: 'foundations',
    title: 'How an account is built',
    subtitle: 'Campaign, ad group, keyword, ad',
    minutes: 9,
    xp: 70,
    objective: 'Know which setting lives at which level, and why putting it at the wrong one costs money.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Four levels, and each owns different decisions', art: 'account-structure',
        blocks: [
          p('Google Ads nests four levels, and the whole craft of structuring an account is knowing which decision belongs where.'),
          list([
            '**Account** — billing, conversion tracking, shared negative lists.',
            '**Campaign** — budget, bidding strategy, locations, languages, networks, schedule.',
            '**Ad group** — a tight set of keywords and the ads that answer them.',
            '**Keyword / Ad** — the query you bid on, and the ad the searcher reads.',
          ]),
          key('Budget lives at the campaign. Relevance lives at the ad group. Mix those up and you get either a campaign you cannot control or an ad group whose ads answer half its keywords.'),
        ],
      },
      {
        kind: 'diagram', id: 'd1', variant: 'account-structure',
        title: 'What lives where',
        caption: 'Settings you can only change at one level. Budget cannot be set per ad group; a keyword cannot have its own location targeting.',
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'You want ₹2,000/day on "running shoes" keywords and ₹500/day on "trail shoes" keywords. What has to be true?',
        options: [
          'Put them in two ad groups and set an ad group budget for each',
          'Put them in two separate campaigns',
          'Use bid adjustments on the ad groups',
          'Set a shared budget across the ad groups',
        ],
        answer: 1,
        explain: 'Budget is a campaign-level setting. There is no such thing as an ad group budget. If two groups of keywords need genuinely separate budgets, they need separate campaigns — which is the single most common reason to split a campaign at all.',
      },
      {
        kind: 'teach', id: 'c2', title: 'The tight-theme rule',
        blocks: [
          p('An ad group should hold keywords that could all be answered by the *same ad*. That is the entire test.'),
          p('"running shoes", "buy running shoes", "running shoes online" belong together — one ad about buying running shoes serves all three. "running shoes" and "hiking boots" do not: no single headline is genuinely relevant to both, so whichever ad you write will be a compromise, and Google will notice.'),
          p('That is not a style preference. Ad relevance is a component of Quality Score, and Quality Score sets what you pay per click.'),
        ],
      },
      {
        kind: 'sort', id: 'q2',
        prompt: 'Put these in order, broadest container first.',
        items: ['Account', 'Campaign', 'Ad group', 'Keyword'],
        explain: 'Account holds campaigns, campaigns hold ad groups, ad groups hold keywords and ads. Budget and bidding sit at the campaign; theme and relevance sit at the ad group.',
      },
      {
        kind: 'scenario', id: 'q3',
        situation: 'An account has one campaign, one ad group, and 340 keywords covering shoes, socks, insoles and laces. Performance is poor. What is the first structural fix?',
        options: [
          { label: 'Raise bids so the ads show more often', correct: false, feedback: 'Bidding harder on a structure this loose just buys more of the same badly-matched traffic. The ads cannot be relevant to 340 keywords across four product categories.' },
          { label: 'Split into ad groups by tight theme, so each has ads that genuinely answer its keywords', correct: true, feedback: 'Right. One ad cannot be relevant to shoes and laces at once, so ad relevance is dragging Quality Score down across the whole account, and every click costs more than it should.' },
          { label: 'Pause the worst keywords and leave the rest', correct: false, feedback: 'Worth doing eventually, but it treats a symptom. The remaining keywords are still sharing ads that do not speak to them.' },
          { label: 'Switch to a Smart Bidding strategy', correct: false, feedback: 'Smart Bidding optimises within the structure you give it. It cannot make one ad relevant to four product categories.' },
        ],
      },
      {
        kind: 'tip', id: 't1', title: 'How many keywords per ad group?',
        text: 'There is no magic number, and anyone who gives you one is selling something. The real test is whether you can write three headlines that are honestly relevant to every keyword in the group. If you cannot, the group is too broad — split it.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 1.3 ──
  {
    slug: 'campaign-types',
    moduleSlug: 'foundations',
    title: 'The campaign types',
    subtitle: 'Search, Shopping, PMax, Display, Video, Demand Gen',
    minutes: 9,
    xp: 70,
    objective: 'Pick the right campaign type for a goal, and recognise when a type is being used to paper over a structural problem.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Six types, three jobs',
        blocks: [
          p('Google sells inventory across very different surfaces under one interface. The types divide roughly by whether they capture demand, create it, or both.'),
          list([
            '**Search** — text ads on results pages. Pure demand capture. The one you learn first.',
            '**Shopping** — product listings with image, price and merchant, driven by a Merchant Center feed. Capture, for retail.',
            '**Performance Max** — one campaign that spans Search, Shopping, Display, YouTube, Gmail and Maps, with Google deciding the split. Both, opaquely.',
            '**Display** — banners across two million sites. Demand creation, cheap and low-intent.',
            '**Video** — YouTube. Demand creation, with the best storytelling surface Google owns.',
            '**Demand Gen** — the closest thing Google has to a Meta campaign: visual, feed-based, audience-targeted.',
          ]),
        ],
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'A D2C brand with 400 SKUs wants to appear when people search for its product categories, showing price and image. Which type?',
        options: ['Search', 'Shopping', 'Display', 'Demand Gen'],
        answer: 1,
        explain: 'Shopping ads pull image, title and price straight from the Merchant Center feed, which is exactly what a 400-SKU catalogue needs. Writing individual text ads for 400 products is not a real option, and Display has no intent behind it.',
      },
      {
        kind: 'teach', id: 'c2', title: 'What Performance Max actually is',
        blocks: [
          p('Performance Max is Google\'s automation-first campaign. You supply assets, a budget, a conversion goal and optional audience signals; Google decides which surfaces to use, which queries to match, and what to show.'),
          p('It genuinely works, and it genuinely hides things. You cannot see most of the search terms it bought. You cannot fully separate Shopping performance from Display performance. When it works you often cannot say *why*, and when it stops working you have fewer levers than you would in Search.'),
          key('PMax trades control for reach. That trade is often correct — but make it on purpose, not because the interface suggested it.'),
        ],
      },
      {
        kind: 'truefalse', id: 'q2',
        statement: 'Performance Max is a good first campaign for a brand new account with no conversion history.',
        isTrue: false,
        explain: 'False, and it is a costly mistake. PMax leans on Smart Bidding, which needs conversion data to learn from. With no history it spends into the dark on the cheapest inventory it can find, which is usually Display. Establish Search and conversion tracking first, then let PMax build on that signal.',
      },
      {
        kind: 'scenario', id: 'q3',
        situation: 'Your Search campaign has 92% impression share and cannot spend its budget. The rep suggests adding Performance Max. Is that the right call?',
        options: [
          { label: 'Yes — you have exhausted Search demand, so expanding surfaces is the honest next step', correct: true, feedback: 'Correct, and note *why* it is correct: you genuinely ran out of demand to capture, which is the one situation where moving to a broader, lower-intent surface makes sense rather than avoiding a problem.' },
          { label: 'No — PMax is always a mistake', correct: false, feedback: 'Too absolute. PMax has a real job, and this is exactly it: growth beyond the demand Search can reach.' },
          { label: 'No — raise Search bids instead', correct: false, feedback: 'At 92% impression share there is almost nothing left to win. Bidding harder buys the remaining 8% at a steep premium and still will not spend the budget.' },
        ],
      },
      {
        kind: 'tip', id: 't1', title: 'The order that works',
        text: 'Search first, because it is the highest intent and the most transparent. Shopping next if you sell products. Performance Max once you have conversion data worth automating against. Display and Video last, and only with a clear demand-creation goal — never because a campaign needs somewhere to put its budget.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 1.4 ──
  {
    slug: 'the-auction',
    moduleSlug: 'foundations',
    title: 'The auction, and why you rarely pay your bid',
    subtitle: 'Ad Rank in one lesson',
    minutes: 10,
    xp: 80,
    objective: 'Work out why a lower bid can beat a higher one, and what you actually pay when it does.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'Every search runs an auction', art: 'ad-rank',
        blocks: [
          p('There is no fixed price for a keyword. Every single time somebody searches, Google runs a fresh auction among the eligible ads, and it happens in the time it takes the page to load.'),
          p('The winner is not the highest bidder. Google ranks by **Ad Rank**, which is roughly your bid multiplied by your ad quality, plus the expected impact of your assets and the context of the search.'),
          key('Ad Rank ≈ Bid × Quality. A great ad with a modest bid routinely outranks a mediocre ad with a huge one.'),
        ],
      },
      {
        kind: 'teach', id: 'c2', title: 'Why this is not Google being generous',
        blocks: [
          p('It would be easy to read quality-weighting as a favour to advertisers. It is not. Google is paid per click, so an ad nobody clicks earns nothing regardless of its bid. Ranking by bid alone would fill the page with high-bidding, irrelevant ads and make search worse — and less profitable.'),
          p('Weighting by expected click-through means Google maximises its own revenue per impression. Your interests happen to align: better ads cost you less.'),
        ],
      },
      {
        kind: 'calc', id: 'calc1', variant: 'ad-rank',
        title: 'Ad Rank calculator',
        blurb: 'Set two advertisers\' bids and Quality Scores and see who wins — and what the winner actually pays.',
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'Advertiser A bids ₹40 with Quality Score 4. Advertiser B bids ₹25 with Quality Score 9. Who ranks higher?',
        options: ['A, because the bid is higher', 'B, because rank is bid times quality', 'They tie', 'Not enough information'],
        answer: 1,
        explain: 'A scores 40 × 4 = 160. B scores 25 × 9 = 225. B wins while bidding almost 40% less. This is why improving Quality Score is worth more than raising bids: it lifts rank and lowers cost at the same time.',
      },
      {
        kind: 'teach', id: 'c3', title: 'What you actually pay',
        blocks: [
          p('Google runs a **second-price** style auction. You pay the minimum needed to hold your position against the advertiser below you — never your full bid.'),
          p('Roughly: your CPC is the Ad Rank of the advertiser below you, divided by your Quality Score, plus one paisa. Two consequences follow, and they are the whole reason this lesson exists:'),
          list([
            'Raising your bid does not necessarily raise your CPC. It raises the *ceiling*, not the price.',
            'Raising your Quality Score directly lowers your CPC, because it is the divisor.',
          ]),
        ],
      },
      {
        kind: 'truefalse', id: 'q2',
        statement: 'If you set a max CPC of ₹50, you will generally pay close to ₹50 per click.',
        isTrue: false,
        explain: 'False. Your max CPC is a ceiling, not a price. You pay just enough to beat the ad below you, which is often far less. Advertisers who do not understand this bid timidly and lose auctions they would have won cheaply.',
      },
      {
        kind: 'scenario', id: 'q3',
        situation: 'Your average position has slipped and CPCs are rising. A competitor has entered the auction. What is the cheaper long-term response?',
        options: [
          { label: 'Raise bids to match them', correct: false, feedback: 'It works, and it works for exactly as long as you keep paying. You have started a bidding war on a keyword where your quality has not changed.' },
          { label: 'Improve ad relevance and landing page experience to lift Quality Score', correct: true, feedback: 'Right. Quality Score multiplies your rank and divides your cost, so it wins position and reduces CPC at once. It is slower than a bid change and it compounds instead of expiring.' },
          { label: 'Pause the keyword', correct: false, feedback: 'Abandoning a converting keyword because someone else showed up is expensive. It only makes sense once the economics genuinely stop working.' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Lesson 1.5 ──
  {
    slug: 'metrics-that-matter',
    moduleSlug: 'foundations',
    title: 'The metrics that decide things',
    subtitle: 'CTR, CPC, conversion rate, CPA, ROAS',
    minutes: 9,
    xp: 70,
    objective: 'Read a Search report in the right order, and know which numbers are diagnostic rather than decisive.',
    cards: [
      {
        kind: 'teach', id: 'c1', title: 'The chain, in order',
        blocks: [
          p('Every Search result is the same chain, and reading it in order is what turns a report into a diagnosis:'),
          list([
            'Impressions → **CTR** → Clicks → **Conversion rate** → Conversions → **Revenue**',
          ], true),
          p('Cost sits alongside it: **CPC** is what a click costs, **CPA** is what a conversion costs, **ROAS** is revenue divided by spend.'),
          key('When something breaks, walk the chain from the top and stop at the first link that moved. The one below it is usually a symptom, not a cause.'),
        ],
      },
      {
        kind: 'teach', id: 'c2', title: 'Which numbers decide, and which only explain',
        blocks: [
          p('**CPA and ROAS decide.** They are the only two that tell you whether to spend more or less, because they are the only two that involve money on both sides.'),
          p('**CTR, CPC and conversion rate explain.** They tell you *why* CPA moved, which is what you need to fix it — but none of them is a goal in itself.'),
          p('A campaign with a 14% CTR and a CPA of ₹4,000 on a ₹1,200 product is a bad campaign with an impressive CTR. Optimising toward CTR would make it worse.'),
        ],
      },
      {
        kind: 'calc', id: 'calc1', variant: 'click-value',
        title: 'What is a click worth?',
        blurb: 'Conversion rate and average order value set the most you can pay per click. Work backwards from margin instead of guessing at a bid.',
      },
      {
        kind: 'mcq', id: 'q1',
        prompt: 'CTR is up 40%, conversion rate is flat, and CPA has risen. What most likely happened?',
        options: [
          'The landing page broke',
          'Broader, cheaper, lower-quality traffic started matching',
          'The ads got worse',
          'Quality Score collapsed',
        ],
        answer: 1,
        explain: 'CTR up with conversion rate flat means more people are clicking without more of them buying — classic broad-match drift into adjacent queries. The clicks are cheaper individually but worth less, so CPA rises. The fix is in the search terms report, not the ads.',
      },
      {
        kind: 'teach', id: 'c3', title: 'Break-even is the number to know before you start',
        blocks: [
          p('Before you can call any CPA good or bad, you need the point where you stop making money. If your margin is 40% on a ₹2,000 order, you clear ₹800 per sale, so break-even CPA is ₹800 and break-even ROAS is 1 ÷ 0.40 = **2.5x**.'),
          p('Below 2.5x you are buying revenue at a loss. Above it you are profitable. That single number reframes every reporting conversation, and most accounts run for months without anyone having worked it out.'),
        ],
      },
      {
        kind: 'calc', id: 'calc2', variant: 'breakeven-cpc',
        title: 'Break-even CPC',
        blurb: 'From margin and conversion rate to the highest CPC you can pay and still make money.',
      },
      {
        kind: 'truefalse', id: 'q2',
        statement: 'A campaign at 2.0x ROAS on a product with a 40% margin is profitable.',
        isTrue: false,
        explain: 'False. Break-even is 1 ÷ 0.40 = 2.5x. At 2.0x every sale loses money — and scaling it loses money faster. This is why margin has to be the first question, not the last.',
      },
      {
        kind: 'tip', id: 't1', title: 'The one number to write on the wall',
        text: 'Break-even ROAS, calculated from real margin including shipping, payment fees and returns. Every bid decision, every budget increase and every "is this working?" conversation resolves against it.',
      },
    ],
  },
];
