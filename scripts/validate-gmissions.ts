/**
 * Google Ads mission gate.
 *
 * Two questions per mission, and the second matters more than the first:
 *
 *   1. Can a learner who does the right thing pass it?
 *   2. Can a learner who does a plausible *wrong* thing fail it?
 *
 * A mission that only satisfies the first is a cutscene. Every scenario here is
 * played twice — once by a solution the module teaches, and once by the most
 * tempting mistake available — and the gate asserts that the first passes and the
 * second does not. It also plays every mission by doing nothing at all, because a
 * mission passable by inaction is not measuring anything.
 *
 * The solutions are deliberately written as a competent learner would perform them
 * rather than as an optimiser would: a handful of negatives, a sensible restructure,
 * a bid moved to somewhere defensible. If a mission only passes under a solution
 * nobody would find, it is tuned wrong and this is where that shows up.
 *
 * Run: npx tsx scripts/validate-gmissions.ts
 */

import { run } from '../src/lib/gsim/engine';
import type { GState } from '../src/lib/gsim/engine/types';
import { ad, adGroup, applyEdits, keyword, negative, type GEdit } from '../src/lib/gsim/state';
import { GOOGLE_MISSIONS } from '../src/lib/gsim/missions';
import { gradeMission } from '../src/lib/gsim/missions/grade';
import type { GMission, GMissionGrade } from '../src/lib/gsim/missions/types';

const SEED = 20260903;

const failures: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail: string) {
  (condition ? notes : failures).push(`  ${condition ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
}
function section(title: string) { notes.push(`\n${title}`); }

/** Plays a mission with a set of edits applied on day zero. */
function play(mission: GMission, prepare: (s: GState) => GState): GMissionGrade {
  const start = prepare(mission.buildState());
  const { state, results } = run(start, mission.durationDays, { seed: SEED });
  return gradeMission({ mission, results, finalState: state });
}

const summarise = (g: GMissionGrade) =>
  `${g.passed ? 'pass' : 'fail'} (${g.score}%) `
  + g.objectives.map((o) => `${o.passed ? '✓' : '✗'} ${o.id}=${fmt(o.actual)}`).join(' ');

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  return n >= 100 ? Math.round(n).toString() : n.toFixed(2);
}

const byId = (id: string) => {
  const m = GOOGLE_MISSIONS.find((x) => x.id === id);
  if (!m) throw new Error(`No mission ${id}`);
  return m;
};

// ───────────────────────────────────────────────────────── shared surgery ──

/** The negatives a competent learner would take off the search terms report after
 *  a week of looking at it. Not exhaustive, and deliberately not perfect. */
const OBVIOUS_NEGATIVES = [
  'repair', 'free', 'jobs', 'salary', 'second hand', 'used', 'wholesale',
  'how to', 'school shoes', 'formal', 'football', 'wikipedia', 'history',
];

function addNegatives(state: GState, texts: string[]): GState {
  return applyEdits(
    state,
    texts.map((text, i): GEdit => ({
      kind: 'add_negative',
      negative: negative({ id: `sol-n${i}`, level: 'account', text, match: 'phrase' }),
    })),
    0,
  );
}

/**
 * The restructure the ads and Quality Score modules teach: themed ad groups, an ad
 * per theme carrying its own keywords, a page per theme behind it.
 *
 * Written once and shared, because three missions want the same move and three
 * copies would drift.
 */
function restructure(state: GState): GState {
  const groups = [
    {
      id: 'sol-trail', name: 'Trail running shoes', page: 1.15,
      keywords: [['sol-k-trail', 'trail running shoes', 'phrase', 62] as const],
      headlines: ['Trail Running Shoes', 'Waterproof Trail Shoes', 'Trail Shoes From ₹3,499'],
    },
    {
      id: 'sol-water', name: 'Waterproof & monsoon', page: 1.15,
      keywords: [
        ['sol-k-water', 'waterproof running shoes', 'phrase', 72] as const,
        ['sol-k-monsoon', 'running shoes for monsoon', 'phrase', 66] as const,
      ],
      headlines: ['Waterproof Running Shoes', 'Running Shoes For Monsoon', 'Stay Dry, Keep Running'],
    },
    {
      id: 'sol-support', name: 'Flat feet & arch support', page: 1.15,
      keywords: [
        ['sol-k-flat', 'running shoes for flat feet', 'phrase', 68] as const,
        ['sol-k-arch', 'running shoes with arch support', 'phrase', 62] as const,
      ],
      headlines: ['Running Shoes For Flat Feet', 'Arch Support Running Shoes', 'Fitted For Overpronation'],
    },
    {
      id: 'sol-buy', name: 'Buy running shoes', page: 1.1,
      keywords: [['sol-k-buy', 'buy running shoes online', 'phrase', 95] as const],
      headlines: ['Buy Running Shoes Online', 'Running Shoes — Free Shipping', 'Order Today, Ships Tomorrow'],
    },
  ];

  const edits: GEdit[] = [];

  // The sprawling group's broad keywords go off; the themed groups replace them.
  for (const k of state.keywords) {
    if (k.id === 'k-brand') continue;
    edits.push({ kind: 'keyword_status', id: k.id, status: 'paused' });
  }

  for (const g of groups) {
    edits.push({
      kind: 'add_adgroup',
      adGroup: adGroup({
        id: g.id, campaignId: 'c-search', name: g.name,
        defaultCpc: g.keywords[0][3], landingPageQuality: g.page,
      }),
    });
    edits.push({
      kind: 'add_ad',
      ad: ad({
        id: `${g.id}-ad`, adGroupId: g.id, headlines: g.headlines,
        descriptions: [`${g.headlines[0]} from NORTHBOUND. Free shipping, 30-day returns.`],
        finalUrl: `/${g.id}`,
      }),
    });
    for (const [id, text, match, bid] of g.keywords) {
      edits.push({
        kind: 'add_keyword',
        keyword: keyword({ id, adGroupId: g.id, text, match, maxCpc: bid }),
      });
    }
  }

  // Brand gets its own group and its own ad, which is most of why it scores ten.
  edits.push({
    kind: 'add_adgroup',
    adGroup: adGroup({ id: 'sol-brand', campaignId: 'c-search', name: 'Brand', defaultCpc: 28, landingPageQuality: 1.2 }),
  });
  edits.push({
    kind: 'add_ad',
    ad: ad({
      id: 'sol-brand-ad', adGroupId: 'sol-brand',
      headlines: ['NORTHBOUND Official Store', 'NORTHBOUND Shoes — Direct', 'Free Shipping & 30-Day Returns'],
      descriptions: ['The official NORTHBOUND store. Every model, every size, shipped free.'],
      finalUrl: '/',
    }),
  });
  edits.push({
    kind: 'add_keyword',
    keyword: keyword({ id: 'sol-k-brand', adGroupId: 'sol-brand', text: 'northbound', match: 'exact', maxCpc: 28 }),
  });
  edits.push({ kind: 'keyword_status', id: 'k-brand', status: 'paused' });

  return applyEdits(state, edits, 0);
}

// ══════════════════════════════════════════ 1. Nothing passes by inaction ═══

section('Doing nothing fails every mission');
for (const mission of GOOGLE_MISSIONS) {
  const grade = play(mission, (s) => s);
  check(`${mission.id} is not passed by inaction`, !grade.passed, `idle: ${summarise(grade)}`);
}

// ═══════════════════════════════════════════ 2. The right move passes ═══════

section('Mission 1 — Read the account');
{
  const m = byId('g-read-the-account');
  const solved = play(m, (s) => addNegatives(s, OBVIOUS_NEGATIVES));
  check('reading the search terms report and cutting the waste passes',
    solved.passed, summarise(solved));

  // The instinct the mission exists to defeat: it looks profitable, so buy more.
  const moreBudget = play(m, (s) =>
    applyEdits(s, [{ kind: 'campaign_budget', id: 'c-search', dailyBudget: 9000 }], 0));
  check('but buying more of an unread account fails',
    !moreBudget.passed, `more-budget: ${summarise(moreBudget)}`);
}

section('Mission 2 — Close the taps');
{
  const m = byId('g-close-the-taps');
  const solved = play(m, (s) => addNegatives(s, OBVIOUS_NEGATIVES));
  check('negating the waste on the report passes', solved.passed, summarise(solved));

  // The mistake the negatives module names by hand: negating ideas, not words.
  const synonyms = play(m, (s) =>
    addNegatives(s, ['cheap', 'discount', 'affordable', 'budget', 'inexpensive', 'bargain', 'low cost', 'sale']));
  check('but negating synonyms of the wrong word fails',
    !synonyms.passed, `synonyms: ${summarise(synonyms)}`);

  // And the other reflex: pausing everything until only brand is left.
  const brandOnly = play(m, (s) => applyEdits(
    s,
    s.keywords.filter((k) => k.id !== 'k-brand')
      .map((k): GEdit => ({ kind: 'keyword_status', id: k.id, status: 'paused' })),
    0,
  ));
  check('and retreating to brand only fails',
    !brandOnly.passed, `brand-only: ${summarise(brandOnly)}`);
}

section('Mission 3 — One ad, four themes');
{
  const m = byId('g-one-ad-four-themes');
  const solved = play(m, (s) => restructure(addNegatives(s, OBVIOUS_NEGATIVES)));
  check('splitting the ad group and writing an ad per theme passes',
    solved.passed, summarise(solved));

  // Bidding at a quality problem: the move the module exists to rule out.
  const bidUp = play(m, (s) => applyEdits(
    s,
    s.keywords.map((k): GEdit => ({ kind: 'keyword_bid', id: k.id, maxCpc: (k.maxCpc ?? 40) * 1.8 })),
    0,
  ));
  check('but bidding harder on the same sprawling group fails',
    !bidUp.passed, `bid-up: ${summarise(bidUp)}`);
}

section('Mission 4 — Rarely shown');
{
  const m = byId('g-below-first-page');
  const solved = play(m, (s) => restructure(addNegatives(s, OBVIOUS_NEGATIVES)));
  check('fixing relevance and the landing page gets the silent keywords serving',
    solved.passed, summarise(solved));

  const bidUp = play(m, (s) => applyEdits(
    s,
    s.keywords.map((k): GEdit => ({ kind: 'keyword_bid', id: k.id, maxCpc: (k.maxCpc ?? 40) * 2.2 })),
    0,
  ));
  check('but doubling every bid does not, and costs a fortune',
    !bidUp.passed, `bid-up: ${summarise(bidUp)}`);
}

section('Mission 5 — Where the impressions went');
{
  const m = byId('g-lost-impression-share');

  // The taught order: fix what you buy, then buy more of it.
  const solved = play(m, (s) => applyEdits(
    restructure(addNegatives(s, OBVIOUS_NEGATIVES)),
    [{ kind: 'campaign_budget', id: 'c-search', dailyBudget: 6200 }],
    0,
  ));
  check('fixing the account and then raising the budget passes', solved.passed, summarise(solved));

  // The reverse order, which is the expensive mistake.
  const budgetFirst = play(m, (s) =>
    applyEdits(s, [{ kind: 'campaign_budget', id: 'c-search', dailyBudget: 6200 }], 0));
  check('but raising the budget first fails', !budgetFirst.passed, `budget-first: ${summarise(budgetFirst)}`);

  // And refusing the money outright leaves the volume objective unmet.
  const fixOnly = play(m, (s) => restructure(addNegatives(s, OBVIOUS_NEGATIVES)));
  check('and fixing without ever spending the approved budget falls short on volume',
    !fixOnly.passed, `fix-only: ${summarise(fixOnly)}`);
}

section('Mission 6 — The campaign that eats brand');
{
  const m = byId('g-pmax-takes-the-brand');

  // No restructure here, deliberately: this mission starts from an account that has
  // already been tidied, which is the only condition under which the problem is
  // visible at all. The fix is the one the module teaches and nothing else.
  const excluded = play(m, (s) => applyEdits(s, [{
    kind: 'add_negative',
    negative: negative({ id: 'sol-pmax-brand', level: 'campaign', ownerId: 'c-pmax', text: 'northbound', match: 'broad' }),
  }], 0));
  check('excluding brand from Performance Max passes', excluded.passed, summarise(excluded));

  // The other fix, which works by a completely different mechanism: an exact-match
  // keyword identical to the query takes precedence over Performance Max by rule,
  // whatever the Ad Ranks say.
  const exactMatch = play(m, (s) =>
    applyEdits(s, [{ kind: 'keyword_match', id: 'f-brand-e', match: 'exact' }], 0));
  check('and holding brand on exact match passes too, by a different mechanism',
    exactMatch.passed, summarise(exactMatch));

  // The reflex that looks decisive and throws away working inventory.
  const killPmax = play(m, (s) =>
    applyEdits(s, [{ kind: 'campaign_status', id: 'c-pmax', status: 'paused' }], 0));
  check('but simply pausing Performance Max fails',
    !killPmax.passed, `pause-pmax: ${summarise(killPmax)}`);

  // And the reflex of throwing money at the Search campaign instead.
  const outbid = play(m, (s) => applyEdits(
    s, [{ kind: 'keyword_bid', id: 'f-brand-e', maxCpc: 140 }], 0));
  check('and out-bidding it on brand does not get the traffic back either',
    !outbid.passed, `outbid: ${summarise(outbid)}`);
}

section('Mission 7 — The cheapest installs in the market');
{
  const m = byId('g-cheapest-installs');

  const solved = play(m, (s) => {
    const c = s.campaigns.find((x) => x.type === 'app')!;
    c.app = {
      ...c.app!,
      goal: 'in_app_action',
      targetEventCpa: 1700,
      assets: { ...c.app!.assets, videos: 4, headlines: 8 },
    };
    return s;
  });
  check('optimising for the first purchase passes', solved.passed, summarise(solved));

  // The instinct: the cost per install is great, so buy more of it.
  const moreBudget = play(m, (s) => applyEdits(
    s, [{ kind: 'campaign_budget', id: 'c-app', dailyBudget: 20_000 }], 0));
  check('but spending more at the same goal fails',
    !moreBudget.passed, `more-budget: ${summarise(moreBudget)}`);

  // And tightening the install target, which is what a team measured on cost per
  // install would actually do next.
  const tighterCpi = play(m, (s) => {
    const c = s.campaigns.find((x) => x.type === 'app')!;
    c.app = { ...c.app!, targetCpi: 22 };
    return s;
  });
  check('and chasing an even cheaper install fails harder',
    !tighterCpi.passed, `tighter-cpi: ${summarise(tighterCpi)}`);
}

// ══════════════════════════════════════════════ 3. Structural sanity ════════

section('Structure');
{
  const ids = new Set(GOOGLE_MISSIONS.map((m) => m.id));
  check('mission ids are unique', ids.size === GOOGLE_MISSIONS.length, `${GOOGLE_MISSIONS.length} missions`);
  check('one mission per Learn module',
    new Set(GOOGLE_MISSIONS.map((m) => m.moduleSlug)).size === GOOGLE_MISSIONS.length,
    GOOGLE_MISSIONS.map((m) => m.moduleSlug).join(', '));
  check('every mission has objectives, hints and a debrief',
    GOOGLE_MISSIONS.every((m) => m.objectives.length >= 2 && m.hints.length >= 2 && m.debrief.length > 200),
    'nothing ships with an empty brief');
  check('ordering is contiguous from 1',
    GOOGLE_MISSIONS.map((m) => m.order).sort((a, b) => a - b)
      .every((o, i) => o === i + 1),
    GOOGLE_MISSIONS.map((m) => m.order).join(', '));
  check('every objective is measurable by the grader',
    GOOGLE_MISSIONS.every((m) => m.objectives.every((o) => o.value >= 0 && Number.isFinite(o.value))),
    'no objective asks for something the engine does not record');
}

// ─────────────────────────────────────────────────────────────── reporting ──

console.log(notes.join('\n'));
if (failures.length > 0) {
  console.error(`\n${failures.length} mission failure(s):\n`);
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`\n${notes.filter((n) => n.startsWith('  ok')).length} mission checks passed.`);
