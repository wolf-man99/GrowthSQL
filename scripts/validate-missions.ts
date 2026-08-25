/**
 * Mission playability gate.
 *
 * A mission nobody has played is a guess. Each one below is played twice, headless:
 * once applying the lesson its module teaches, and once applying a plausible wrong
 * instinct a learner might arrive with. The lesson has to pass and the wrong
 * instinct has to fail.
 *
 * That second half matters more than the first. A mission that passes whatever you
 * do is not teaching, it is decorating, and it would give a learner false
 * confidence in a habit that will cost them money on a real account.
 *
 * Run: npx tsx scripts/validate-missions.ts
 */

import { applyEdit, tick, type SimEdit, type SimState, type DayResult } from '../src/lib/simulator/engine';
import { resolveCreative } from '../src/lib/simulator/creatives';
import { MISSIONS, gradeMission, missionById, type Mission } from '../src/lib/simulator/missions';

const SEED = 424242;

const failures: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail: string) {
  (condition ? notes : failures).push(`  ${condition ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
}

/**
 * Plays a mission to its horizon, applying a strategy's edits on the days it asks.
 *
 * Strategies are expressed as "on day N, make these edits", which is how a learner
 * actually plays: look at what happened, change something, advance again.
 */
type Strategy = (day: number, state: SimState) => SimEdit[];

function play(mission: Mission, strategy: Strategy) {
  let state = mission.buildState();
  const results: DayResult[] = [];
  const opts = { seed: SEED, resolveCreative };

  for (let day = 0; day < mission.durationDays; day++) {
    for (const event of mission.events) {
      if (event.day === day) {
        state = structuredClone(state);
        if (event.kind === 'landingPageQuality') state.conditions.landingPageQuality *= event.factor;
        if (event.kind === 'marketPressure') state.conditions.marketPressure *= event.factor;
        if (event.kind === 'aov') state.conditions.aov = Math.round(state.conditions.aov * event.factor);
      }
    }
    for (const edit of strategy(day, state)) {
      const outcome = applyEdit(state, edit);
      if (outcome.error) throw new Error(`${mission.id}: edit rejected on day ${day}: ${outcome.error}`);
      state = outcome.state;
    }
    const step = tick(state, opts);
    state = step.state;
    results.push(step.result);
  }

  return { grade: gradeMission({ mission, results, finalState: state }), state, results };
}

/** Does nothing at all: the baseline every mission must be un-passable from. */
const doNothing: Strategy = () => [];

function report(mission: Mission, label: string, grade: ReturnType<typeof gradeMission>): string {
  const parts = grade.objectives.map((o) => `${o.passed ? '✓' : '✗'} ${o.id}`);
  return `${label}: ${grade.passed ? 'PASS' : 'fail'} (${grade.score}%) ${parts.join(' ')}`;
}

// ─────────────────────────────────────────────────────── structural checks ──

notes.push('Structure');
check('every Learn module has exactly one mission',
  new Set(MISSIONS.map((m) => m.moduleSlug)).size === MISSIONS.length && MISSIONS.length === 7,
  `${MISSIONS.length} missions across ${new Set(MISSIONS.map((m) => m.moduleSlug)).size} modules`);
check('mission ids are unique', new Set(MISSIONS.map((m) => m.id)).size === MISSIONS.length, 'no duplicates');
check('every mission has objectives and a debrief',
  MISSIONS.every((m) => m.objectives.length > 0 && m.debrief.length > 80 && m.hints.length > 0),
  'all seven carry measurable objectives, hints, and a written debrief');
check('every mission builds a valid starting state',
  MISSIONS.every((m) => {
    const s = m.buildState();
    return s.campaigns.length > 0 && s.adSets.length > 0 && s.ads.length > 0
      && s.adSets.every((a) => s.audiences.some((x) => x.id === a.audienceId))
      && s.ads.every((ad) => s.adSets.some((a) => a.id === ad.adSetId));
  }),
  'entities all resolve to real parents and audiences');

// ─────────────────────────────────────────────── doing nothing never works ──

notes.push('\nDoing nothing fails every mission');
for (const m of MISSIONS) {
  const { grade } = play(m, doNothing);
  check(`${m.id} is not passed by inaction`, !grade.passed, report(m, 'idle', grade));
}

// ────────────────────────────────────────────────── 1. read-the-account ──

notes.push('\nMission 1 — read the account');
{
  const m = missionById('read-the-account')!;
  // The lesson: pause everything under break-even, leave everything above it.
  const lesson: Strategy = (day) => day !== 1 ? [] : [
    { kind: 'setStatus', level: 'campaign', id: 'c-vanity', status: 'paused' },
    { kind: 'setStatus', level: 'campaign', id: 'c-interest', status: 'paused' },
  ];
  // The wrong instinct: chase the highest ROAS by pausing everything except
  // retargeting, which looks best per rupee and cannot carry an account.
  const wrong: Strategy = (day) => day !== 1 ? [] : [
    { kind: 'setStatus', level: 'campaign', id: 'c-vanity', status: 'paused' },
    { kind: 'setStatus', level: 'campaign', id: 'c-interest', status: 'paused' },
    { kind: 'setStatus', level: 'campaign', id: 'c-broad', status: 'paused' },
  ];
  const a = play(m, lesson).grade;
  const b = play(m, wrong).grade;
  check('cutting the loss-maker passes', a.passed, report(m, 'lesson', a));
  check('cutting everything but retargeting fails', !b.passed, report(m, 'retargeting-only', b));
}

// ────────────────────────────────────────────────────── 2. warm-vs-cold ──

notes.push('\nMission 2 — right message, right temperature');
{
  const m = missionById('warm-vs-cold')!;
  // The lesson: give the cold audiences creative built for strangers.
  const lesson: Strategy = (day) => day !== 1 ? [] : [
    { kind: 'setAdCreative', id: 'ad-broad', creativeId: 'cr-ugc-street', format: 'video' },
    { kind: 'setAdCreative', id: 'ad-lal', creativeId: 'cr-founder', format: 'video' },
  ];
  // The wrong instinct: the ads are underperforming, so spend more on them.
  const wrong: Strategy = (day) => day !== 1 ? [] : [
    { kind: 'setAdSetBudget', id: 'as-broad', dailyBudget: 8_000 },
    { kind: 'setAdSetBudget', id: 'as-lal', dailyBudget: 6_000 },
  ];
  const a = play(m, lesson).grade;
  const b = play(m, wrong).grade;
  check('matching creative to temperature passes', a.passed, report(m, 'lesson', a));
  check('spending more on mismatched creative fails', !b.passed, report(m, 'more-budget', b));
}

// ──────────────────────────────────────────────── 3. refresh-the-winner ──

notes.push('\nMission 3 — the winner is wearing out');
{
  const m = missionById('refresh-the-winner')!;
  // The lesson: refresh the fatiguing creative.
  const lesson: Strategy = (day) => day !== 2 ? [] : [
    { kind: 'setAdCreative', id: 'ad-offer', creativeId: 'cr-ugc-switch', format: 'video' },
  ];
  // The wrong instinct: it is still the best ad, so back it harder.
  const wrong: Strategy = (day) => day !== 2 ? [] : [
    { kind: 'setAdSetBudget', id: 'as-interest', dailyBudget: 9_000 },
  ];
  const a = play(m, lesson).grade;
  const b = play(m, wrong).grade;
  check('refreshing the creative passes', a.passed, report(m, 'lesson', a));
  check('pouring budget into a tired ad fails', !b.passed, report(m, 'more-budget', b));
}

// ──────────────────────────────────────── 4. escape-learning-limited ──

notes.push('\nMission 4 — eight ad sets, none of them learning');
{
  const m = missionById('escape-learning-limited')!;
  // The lesson: consolidate the same money into three ad sets.
  const consolidate: Strategy = (day) => {
    if (day !== 1) return [];
    const edits: SimEdit[] = [];
    for (let i = 3; i < 8; i++) edits.push({ kind: 'setStatus', level: 'adset', id: `as-${i}`, status: 'paused' });
    for (let i = 0; i < 3; i++) edits.push({ kind: 'setAdSetBudget', id: `as-${i}`, dailyBudget: 4_000 });
    return edits;
  };
  // The documented alternative: keep all eight, optimise for a cheaper event.
  const cheaperEvent: Strategy = (day) => day !== 1 ? [] :
    Array.from({ length: 8 }, (_, i) => ({
      kind: 'setOptimisationEvent' as const, id: `as-${i}`, optimisationEvent: 'add_to_cart' as const,
    }));
  // The wrong instinct: test harder by adding more ad sets on the same money.
  const wrong: Strategy = (day) => day !== 1 ? [] :
    Array.from({ length: 8 }, (_, i) => ({
      kind: 'setAdSetBudget' as const, id: `as-${i}`, dailyBudget: 900,
    }));
  const a = play(m, consolidate).grade;
  const b = play(m, cheaperEvent).grade;
  const c = play(m, wrong).grade;
  check('consolidating passes', a.passed, report(m, 'consolidate', a));
  check('optimising for a cheaper event also passes', b.passed, report(m, 'cheaper-event', b));
  check('spreading the money thinner fails', !c.passed, report(m, 'spread-thinner', c));
}

// ──────────────────────────────────────────────────────── 5. a-clean-test ──

notes.push('\nMission 5 — run a test you can believe');
{
  const m = missionById('a-clean-test')!;
  // The lesson: move the budget down to the ad sets so each arm gets a fair read,
  // on a budget that funds two arms properly rather than three badly.
  const lesson: Strategy = (day) => {
    if (day !== 0) return [];
    return [
      { kind: 'setBudgetMode', id: 'c-test', budgetMode: 'abo' },
      { kind: 'setStatus', level: 'adset', id: 'as-c', status: 'paused' },
      { kind: 'setAdSetBudget', id: 'as-a', dailyBudget: 4_500 },
      { kind: 'setAdSetBudget', id: 'as-b', dailyBudget: 4_500 },
    ];
  };
  // The wrong instinct: leave CBO to "find the winner for you".
  const a = play(m, lesson).grade;
  const b = play(m, doNothing).grade;
  check('ad set budgets give each arm a fair read', a.passed, report(m, 'lesson', a));
  check('leaving CBO to pick fails', !b.passed, report(m, 'leave-cbo', b));
}

// ───────────────────────────────────────────────── 6. diagnose-the-drop ──

notes.push('\nMission 6 — sales fell and the ads look fine');
{
  const m = missionById('diagnose-the-drop')!;
  // The lesson: fix the ad set that was genuinely broken, and hold your nerve on
  // the conversion-rate drop, which is downstream and not yours to fix. The
  // checkout repair arrives on day 14 as a scheduled event, which is the honest
  // shape of it: the media buyer's job was to diagnose and not make it worse.
  const lesson: Strategy = (day) => day !== 2 ? [] : [
    { kind: 'setAdSetBudget', id: 'as-interest', dailyBudget: 6_000 },
  ];
  const a = play(m, lesson).grade;
  // The wrong instinct: CVR fell, so cut spend to protect ROAS.
  const wrong: Strategy = (day) => day !== 8 ? [] : [
    { kind: 'setAdSetBudget', id: 'as-broad', dailyBudget: 1_200 },
    { kind: 'setStatus', level: 'adset', id: 'as-cart', status: 'paused' },
  ];
  const b = play(m, wrong).grade;
  // The other wrong instinct: rebuild the creative the data already cleared.
  const alsoWrong: Strategy = (day) => day !== 8 ? [] : [
    { kind: 'setAdCreative', id: 'ad-broad', creativeId: 'cr-lookbook', format: 'image' },
  ];
  const c = play(m, alsoWrong).grade;
  check('fixing the real problem and holding through the break passes', a.passed, report(m, 'lesson', a));
  check('holding without fixing the starved ad set fails', !play(m, doNothing).grade.passed,
    report(m, 'hold-only', play(m, doNothing).grade));
  check('cutting spend to protect ROAS fails', !b.passed, report(m, 'retreat', b));
  check('rebuilding the creative that was working fails', !c.passed, report(m, 'wrong-fix', c));
}

// ────────────────────────────────────────────── 7. scale-without-breaking ──

notes.push('\nMission 7 — triple the spend, keep the economics');
{
  const m = missionById('scale-without-breaking')!;
  // The lesson: gentle vertical steps plus horizontal expansion into fresh pools.
  const lesson: Strategy = (day, state) => {
    const edits: SimEdit[] = [];
    // Open two genuinely new audiences early, so there are more people to reach.
    if (day === 1) {
      edits.push({
        kind: 'createAdSet',
        adSet: {
          id: 'as-new-35', campaignId: 'c-cold', name: 'Broad 35-54', audienceId: 'a-broad-35',
          dailyBudget: 2_500, optimisationEvent: 'purchase', advantagePlacements: true,
        },
      });
      edits.push({
        kind: 'createAd',
        ad: {
          id: 'ad-new-35', adSetId: 'as-new-35', name: 'UGC 35-54', creativeId: 'cr-ugc-switch',
          format: 'video', primaryText: '', headline: '', description: '', cta: 'Shop now',
          destinationUrl: 'https://northbound.example/shop',
        },
      });
    }
    if (day === 5) {
      edits.push({
        kind: 'createAdSet',
        adSet: {
          id: 'as-new-lal', campaignId: 'c-cold', name: 'Lookalike 3%', audienceId: 'a-lal',
          dailyBudget: 2_500, optimisationEvent: 'purchase', advantagePlacements: true,
        },
      });
      edits.push({
        kind: 'createAd',
        ad: {
          id: 'ad-new-lal', adSetId: 'as-new-lal', name: 'Founder story', creativeId: 'cr-founder',
          format: 'video', primaryText: '', headline: '', description: '', cta: 'Shop now',
          destinationUrl: 'https://northbound.example/shop',
        },
      });
    }
    // ...and step the existing ad sets up ~20% every third day, never tripping the
    // significance threshold that would reset learning or shock delivery.
    if (day >= 2 && day <= 16 && day % 3 === 0) {
      for (const a of state.adSets) {
        if (a.status !== 'active' || !a.dailyBudget) continue;
        edits.push({ kind: 'setAdSetBudget', id: a.id, dailyBudget: Math.round(a.dailyBudget * 1.2) });
      }
    }
    return edits;
  };
  // The wrong instinct: the brand wants 18k, so set 18k.
  const wrong: Strategy = (day) => day !== 1 ? [] : [
    { kind: 'setAdSetBudget', id: 'as-broad', dailyBudget: 15_000 },
    { kind: 'setAdSetBudget', id: 'as-cart', dailyBudget: 3_000 },
  ];
  const a = play(m, lesson).grade;
  const b = play(m, wrong).grade;
  check('stepping up and expanding sideways passes', a.passed, report(m, 'lesson', a));
  check('jumping straight to the target fails', !b.passed, report(m, 'overnight-jump', b));
}

// ──────────────────────────────────────────────────────────────── report ──

console.log(notes.join('\n'));
if (failures.length > 0) {
  console.error(`\n${failures.length} mission failure(s):\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`\nMissions verified: ${notes.filter((n) => n.startsWith('  ok')).length} checks across ${MISSIONS.length} missions.`);
