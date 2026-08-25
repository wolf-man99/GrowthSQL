/**
 * Simulator calibration gate.
 *
 * The Run tier's whole claim is that the lessons taught in Learn are things the
 * account actually does. That claim is only true if the model behaves the way the
 * curriculum says ad accounts behave, so this script asserts exactly that, module
 * by module. A model that drifts out of calibration teaches the wrong lesson
 * confidently, which is worse than a model that visibly breaks.
 *
 * These are behavioural assertions, not snapshot tests: they check relationships
 * ("fatigue erodes CTR", "consolidating escapes Learning Limited") rather than
 * exact figures, so the tuning constants in engine/types.ts can be adjusted
 * without rewriting the suite. Only the last check pins exact numbers, and it
 * pins them to a rerun of the engine itself, to prove replays are deterministic.
 *
 * Run: npx tsx scripts/validate-simulator.ts
 */

import {
  applyEdit, MODEL, mergeSegments, previewReset, run, tick,
  PLACEMENTS, SEGMENT_DIMENSIONS, type DayResult,
} from '../src/lib/simulator/engine';
import { resolveCreative } from '../src/lib/simulator/creatives';
import { ad, adSet, audience, campaign, state } from '../src/lib/simulator/factory';
import { buildSandboxAccount } from '../src/lib/simulator/scenarios/sandbox';

const OPTS = { seed: 20260812, resolveCreative };

const failures: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail: string) {
  if (condition) {
    notes.push(`  ok   ${label} — ${detail}`);
  } else {
    failures.push(`  FAIL ${label} — ${detail}`);
  }
}

function section(title: string) {
  notes.push(`\n${title}`);
}

// Aggregate helpers over a slice of day results.
const sum = (rs: DayResult[], f: (r: DayResult) => number) => rs.reduce((a, r) => a + f(r), 0);
const ctrOf = (rs: DayResult[]) =>
  (sum(rs, (r) => r.account.linkClicks) / Math.max(1, sum(rs, (r) => r.account.impressions))) * 100;
const cpmOf = (rs: DayResult[]) =>
  (sum(rs, (r) => r.account.spend) / Math.max(1, sum(rs, (r) => r.account.impressions))) * 1000;
const cvrOf = (rs: DayResult[]) =>
  (sum(rs, (r) => r.account.purchases) / Math.max(1, sum(rs, (r) => r.account.linkClicks))) * 100;

// ───────────────────────────────────────────────── 1. realistic output bands ──
//
// Module 1.4: the metrics have to look like a real Indian D2C account, or every
// benchmark the curriculum quotes reads as wrong the moment a learner opens Run.

section('Module 1.4 — metrics land in realistic bands');
{
  const cold = state({
    audiences: [audience('aud-broad', 'Broad 18-34', 4_000_000, 0)],
    campaigns: [campaign('c1', 'Prospecting', { strategyTag: 'prospecting' })],
    adSets: [adSet('as1', 'c1', 'Broad', 'aud-broad', { dailyBudget: 4000 })],
    ads: [ad('ad1', 'as1', 'UGC', 'cr-ugc-street', { format: 'video' })],
  });
  const { results } = run(cold, 14, OPTS);
  const first = results.slice(0, 7); // before fatigue has a chance to bite

  check('prospecting CPM', cpmOf(first) > 60 && cpmOf(first) < 200, `₹${cpmOf(first).toFixed(0)} (expect 60-200)`);
  check('prospecting CTR', ctrOf(first) > 0.6 && ctrOf(first) < 3.0, `${ctrOf(first).toFixed(2)}% (expect 0.6-3.0)`);
  check('prospecting CVR', cvrOf(first) > 1.5 && cvrOf(first) < 6.5, `${cvrOf(first).toFixed(2)}% (expect 1.5-6.5)`);

  const warm = state({
    audiences: [audience('aud-cart', 'Cart abandoners 7d', 18_000, 1, { type: 'custom' })],
    campaigns: [campaign('c1', 'Retargeting', { strategyTag: 'retargeting' })],
    adSets: [adSet('as1', 'c1', 'Cart 7d', 'aud-cart', { dailyBudget: 1800 })],
    ads: [ad('ad1', 'as1', 'Nudge', 'cr-retarget-nudge')],
  });
  const warmRes = run(warm, 7, OPTS).results;
  check('retargeting CPM exceeds prospecting', cpmOf(warmRes) > cpmOf(first) * 1.8,
    `₹${cpmOf(warmRes).toFixed(0)} vs ₹${cpmOf(first).toFixed(0)} — small pools are contested`);
  check('retargeting CVR exceeds prospecting', cvrOf(warmRes) > cvrOf(first) * 1.5,
    `${cvrOf(warmRes).toFixed(2)}% vs ${cvrOf(first).toFixed(2)}% — warm audiences convert`);
}

// ────────────────────────────────────────────────── 2. creative fatigue (6.1) ──
//
// One ad, one audience, left alone: frequency climbs, CTR sags, CPM drifts up.
// This is the single most important behaviour in the model, because module 6.1
// asks learners to recognise the pattern unaided.

section('Module 6.1 — creative fatigue emerges without being scripted');
{
  const s = state({
    // A small pool run hard, so the account genuinely saturates inside the window.
    // Sized deliberately: on a broad audience fatigue is real but takes months, and
    // a test that cannot reach high frequency proves nothing about the decay curve.
    audiences: [audience('aud', 'Narrow interest', 60_000, 0.2)],
    campaigns: [campaign('c1', 'Prospecting')],
    adSets: [adSet('as1', 'c1', 'Interest', 'aud', { dailyBudget: 3500 })],
    ads: [ad('ad1', 'as1', 'Offer slab', 'cr-offer-slab')],
  });
  const { results } = run(s, 40, OPTS);
  const early = results.slice(0, 5);
  const late = results.slice(-5);

  const freqEarly = results[4].adSets[0].frequency;
  const freqLate = results[results.length - 1].adSets[0].frequency;

  check('frequency climbs', freqLate > freqEarly * 2,
    `${freqEarly.toFixed(2)} -> ${freqLate.toFixed(2)}`);
  check('CTR decays', ctrOf(late) < ctrOf(early) * 0.75,
    `${ctrOf(early).toFixed(2)}% -> ${ctrOf(late).toFixed(2)}%`);
  check('CPM rises', cpmOf(late) > cpmOf(early) * 1.1,
    `₹${cpmOf(early).toFixed(0)} -> ₹${cpmOf(late).toFixed(0)}`);

  // The lesson's corollary: a low-fatigue creative on identical settings holds up
  // better. If this fails, `fatigueRate` is not actually differentiating assets.
  const durable = structuredClone(s);
  durable.ads[0].creativeId = 'cr-ugc-street';
  const durableLate = run(durable, 40, OPTS).results.slice(-5);
  check('durable creative outlasts the offer slab', ctrOf(durableLate) > ctrOf(late),
    `UGC ${ctrOf(durableLate).toFixed(2)}% vs slab ${ctrOf(late).toFixed(2)}% at day 40`);
}

// ──────────────────────────────────────── 3. learning phase & the 50-event rule ──
//
// Module 4.2's own scenario, playable: eight ad sets at ₹15/day are all starved;
// consolidating the same total budget into three lets each clear the threshold.

section('Module 4.2 — consolidation escapes Learning Limited');
{
  // Sized against the model's own measured economics on this 400k audience, where
  // scarcity pushes CPM up and a purchase costs roughly ₹400: clearing 50 events in
  // 7 days needs somewhere between ₹3,000 and ₹4,000/day. The same ₹12,000 split
  // eight ways gives ₹1,500 each and strands all of them; split three ways it gives
  // ₹4,000 each, which clears the threshold.
  const TOTAL = 12_000;

  const spread = state({
    audiences: Array.from({ length: 8 }, (_, i) => audience(`aud${i}`, `Segment ${i}`, 400_000, 0.1)),
    campaigns: [campaign('c1', 'Prospecting')],
    adSets: Array.from({ length: 8 }, (_, i) =>
      adSet(`as${i}`, 'c1', `Segment ${i}`, `aud${i}`, { dailyBudget: TOTAL / 8 })),
    ads: Array.from({ length: 8 }, (_, i) => ad(`ad${i}`, `as${i}`, `Ad ${i}`, 'cr-ugc-street')),
  });
  const spreadOut = run(spread, 21, OPTS);
  const spreadLimited = spreadOut.state.adSets.filter((a) => a.runtime.learningState === 'limited').length;

  const consolidated = state({
    audiences: Array.from({ length: 3 }, (_, i) => audience(`aud${i}`, `Segment ${i}`, 400_000, 0.1)),
    campaigns: [campaign('c1', 'Prospecting')],
    adSets: Array.from({ length: 3 }, (_, i) =>
      adSet(`as${i}`, 'c1', `Segment ${i}`, `aud${i}`, { dailyBudget: TOTAL / 3 })),
    ads: Array.from({ length: 3 }, (_, i) => ad(`ad${i}`, `as${i}`, `Ad ${i}`, 'cr-ugc-street')),
  });
  const consolidatedOut = run(consolidated, 21, OPTS);
  const consolidatedActive = consolidatedOut.state.adSets.filter((a) => a.runtime.learningState === 'active').length;

  check('spreading the budget strands ad sets in Learning Limited', spreadLimited >= 6,
    `${spreadLimited}/8 limited at ₹${TOTAL / 8}/day each`);
  check('consolidating the same budget stabilises them', consolidatedActive >= 2,
    `${consolidatedActive}/3 active at ₹${Math.round(TOTAL / 3)}/day each`);
  check('consolidation buys more purchases from identical spend',
    consolidatedOut.state.adSets.reduce((n, a) => n + a.runtime.purchases, 0) >
    spreadOut.state.adSets.reduce((n, a) => n + a.runtime.purchases, 0),
    `${consolidatedOut.state.adSets.reduce((n, a) => n + a.runtime.purchases, 0)} vs ${spreadOut.state.adSets.reduce((n, a) => n + a.runtime.purchases, 0)} purchases`);

  // The other documented escape: optimise for a more frequent event.
  const cheaperEvent = structuredClone(spread);
  for (const a of cheaperEvent.adSets) a.optimisationEvent = 'add_to_cart';
  const cheaperOut = run(cheaperEvent, 21, OPTS);
  const cheaperLimited = cheaperOut.state.adSets.filter((a) => a.runtime.learningState === 'limited').length;
  check('optimising for a cheaper event also escapes', cheaperLimited < spreadLimited,
    `${cheaperLimited}/8 limited on Add to Cart vs ${spreadLimited}/8 on Purchase`);
}

// ─────────────────────────────────────────────── 4. self-overlap penalty (7.2) ──

section('Module 7.2 — duplicating onto the same audience is self-competition');
{
  const base = {
    audiences: [audience('shared', 'Lookalike 3%', 600_000, 0.15)],
    campaigns: [campaign('c1', 'Prospecting')],
  };
  const single = state({
    ...base,
    adSets: [adSet('as1', 'c1', 'Original', 'shared', { dailyBudget: 2000 })],
    ads: [ad('ad1', 'as1', 'Ad', 'cr-ugc-street')],
  });
  // Same total spend, but split across four copies pointed at the identical pool.
  const duplicated = state({
    ...base,
    adSets: Array.from({ length: 4 }, (_, i) =>
      adSet(`as${i}`, 'c1', `Copy ${i}`, 'shared', { dailyBudget: 500 })),
    ads: Array.from({ length: 4 }, (_, i) => ad(`ad${i}`, `as${i}`, `Ad ${i}`, 'cr-ugc-street')),
  });
  // ...versus split across four genuinely distinct pools.
  const expanded = state({
    audiences: Array.from({ length: 4 }, (_, i) => audience(`aud${i}`, `Pool ${i}`, 600_000, 0.15)),
    campaigns: [campaign('c1', 'Prospecting')],
    adSets: Array.from({ length: 4 }, (_, i) =>
      adSet(`as${i}`, 'c1', `Set ${i}`, `aud${i}`, { dailyBudget: 500 })),
    ads: Array.from({ length: 4 }, (_, i) => ad(`ad${i}`, `as${i}`, `Ad ${i}`, 'cr-ugc-street')),
  });

  const singleCpm = cpmOf(run(single, 7, OPTS).results);
  const dupCpm = cpmOf(run(duplicated, 7, OPTS).results);
  const expandedCpm = cpmOf(run(expanded, 7, OPTS).results);

  check('cloning onto the same audience inflates CPM', dupCpm > singleCpm * 1.2,
    `₹${singleCpm.toFixed(0)} -> ₹${dupCpm.toFixed(0)} across 4 copies`);
  check('expanding to new audiences does not', expandedCpm < dupCpm * 0.95,
    `₹${expandedCpm.toFixed(0)} on fresh pools vs ₹${dupCpm.toFixed(0)} on one`);
}

// ──────────────────────────────────────────────── 5. scaling discipline (7.1) ──

section('Module 7.1 — gentle vertical scaling beats an overnight jump');
{
  const build = () => state({
    audiences: [audience('aud', 'Broad', 3_000_000, 0.1)],
    campaigns: [campaign('c1', 'Prospecting')],
    adSets: [adSet('as1', 'c1', 'Winner', 'aud', { dailyBudget: 2000 })],
    ads: [ad('ad1', 'as1', 'Ad', 'cr-ugc-street')],
  });

  const START = 2000;
  const TARGET = Math.round(START * 1.2 ** 7); // where seven ~20% steps would land

  // Three arms, all measured over the same fortnight at the same daily budget, so
  // the only thing that differs is how each one arrived there. Comparing against a
  // control that was *already* running at the target is what isolates the cost of
  // the jump itself: comparing jump-vs-steps alone would mostly measure the fact
  // that a ramping ad set spends less money and therefore saturates less.
  const control = structuredClone(run(build(), 14, OPTS).state);
  control.adSets[0].dailyBudget = TARGET;
  control.adSets[0].runtime.budgetEma = TARGET; // settled here, no shock owed
  const controlOut = run(control, 14, OPTS);

  const jumped = structuredClone(run(build(), 14, OPTS).state);
  jumped.adSets[0].dailyBudget = TARGET; // the whole increase, overnight
  jumped.adSets[0].runtime.learningResetDay = jumped.day; // a significant edit resets learning
  jumped.adSets[0].runtime.trailingEvents = [];
  const jumpedOut = run(jumped, 14, OPTS);

  let steppedState = structuredClone(run(build(), 14, OPTS).state);
  const steppedResults: DayResult[] = [];
  // ~20% every other day: each step stays under the significance threshold, so
  // delivery is never knocked back into learning and never shocked.
  for (let d = 0; d < 14; d++) {
    if (d % 2 === 0) {
      const cur = steppedState.adSets[0].dailyBudget ?? START;
      steppedState.adSets[0].dailyBudget = Math.min(TARGET, Math.round(cur * 1.2));
    }
    const step = tick(steppedState, OPTS);
    steppedState = step.state;
    steppedResults.push(step.result);
  }

  const cpaOver = (rs: DayResult[]) =>
    sum(rs, (r) => r.account.spend) / Math.max(1, sum(rs, (r) => r.account.purchases));
  const controlCpa = cpaOver(controlOut.results);
  const jumpedCpa = cpaOver(jumpedOut.results);
  const steppedCpa = cpaOver(steppedResults);

  check('all arms finish at the same daily budget',
    Math.abs((jumpedOut.state.adSets[0].dailyBudget ?? 0) - (steppedState.adSets[0].dailyBudget ?? 0)) <= 2,
    `₹${TARGET}/day either way, so this compares method not scale`);
  check('jumping costs more than having been there all along',
    jumpedCpa > controlCpa * 1.05,
    `jump ₹${jumpedCpa.toFixed(0)} vs settled ₹${controlCpa.toFixed(0)} per purchase at the same budget`);
  check('stepping up avoids most of that cost',
    steppedCpa < jumpedCpa,
    `stepped ₹${steppedCpa.toFixed(0)} vs jumped ₹${jumpedCpa.toFixed(0)}`);
  check('the jump spends time back in learning',
    jumpedOut.state.adSets[0].runtime.learningResetDay > steppedState.adSets[0].runtime.learningResetDay,
    `reset on day ${jumpedOut.state.adSets[0].runtime.learningResetDay} vs ${steppedState.adSets[0].runtime.learningResetDay}`);
}

// ─────────────────────────────────────────────────── 6. CBO behaviour (4.1) ──

section('Module 4.1 — CBO concentrates spend and starves untested ad sets');
{
  const s = state({
    audiences: Array.from({ length: 5 }, (_, i) => audience(`aud${i}`, `Audience ${i}`, 800_000, 0.1)),
    campaigns: [campaign('c1', 'Scaling', { budgetMode: 'cbo', dailyBudget: 10_000 })],
    adSets: Array.from({ length: 5 }, (_, i) => adSet(`as${i}`, 'c1', `Set ${i}`, `aud${i}`)),
    ads: Array.from({ length: 5 }, (_, i) => ad(`ad${i}`, `as${i}`, `Ad ${i}`, 'cr-ugc-street')),
  });
  const out = run(s, 14, OPTS);
  const spends = out.state.adSets.map((a) => a.runtime.spend).sort((a, b) => b - a);
  const total = spends.reduce((a, b) => a + b, 0);
  const topShare = spends[0] / Math.max(1, total);

  check('CBO gives the front-runner a dominant share', topShare > 0.35,
    `top ad set took ${(topShare * 100).toFixed(0)}% of spend across 5`);
  check('CBO leaves the tail under-tested', spends[4] / Math.max(1, total) < 0.12,
    `bottom ad set got ${((spends[4] / Math.max(1, total)) * 100).toFixed(0)}%`);

  // The counterpart: ABO with the same total spends evenly, which is why it is the
  // right tool for a fair test.
  const abo = state({
    audiences: Array.from({ length: 5 }, (_, i) => audience(`aud${i}`, `Audience ${i}`, 800_000, 0.1)),
    campaigns: [campaign('c1', 'Testing', { budgetMode: 'abo' })],
    adSets: Array.from({ length: 5 }, (_, i) => adSet(`as${i}`, 'c1', `Set ${i}`, `aud${i}`, { dailyBudget: 2000 })),
    ads: Array.from({ length: 5 }, (_, i) => ad(`ad${i}`, `as${i}`, `Ad ${i}`, 'cr-ugc-street')),
  });
  const aboSpends = run(abo, 14, OPTS).state.adSets.map((a) => a.runtime.spend);
  const aboTop = Math.max(...aboSpends) / Math.max(1, aboSpends.reduce((a, b) => a + b, 0));
  check('ABO spends evenly enough to judge each ad set', aboTop < 0.28,
    `largest share ${(aboTop * 100).toFixed(0)}% of 5 ad sets`);
}

// ──────────────────────────────────── 7. downstream breakage presents as ads (6.2) ──

section('Module 6.2 — a broken checkout looks like an ads problem');
{
  const healthy = state({
    audiences: [audience('aud', 'Broad', 2_000_000, 0.1)],
    campaigns: [campaign('c1', 'Prospecting')],
    adSets: [adSet('as1', 'c1', 'Broad', 'aud', { dailyBudget: 5000 })],
    ads: [ad('ad1', 'as1', 'Ad', 'cr-ugc-street')],
  });
  const broken = structuredClone(healthy);
  broken.conditions.landingPageQuality = 0.45;

  const h = run(healthy, 10, OPTS).results;
  const b = run(broken, 10, OPTS).results;

  check('CVR collapses', cvrOf(b) < cvrOf(h) * 0.6,
    `${cvrOf(h).toFixed(2)}% -> ${cvrOf(b).toFixed(2)}%`);
  check('CTR is untouched, so the ads look innocent', Math.abs(ctrOf(b) - ctrOf(h)) < 0.15,
    `${ctrOf(h).toFixed(2)}% vs ${ctrOf(b).toFixed(2)}% — the leak is after the click`);
}

// ────────────────────────────────────────────────────── 8. replay determinism ──

section('Engine — replays are deterministic');
{
  const build = () => state({
    audiences: [audience('aud', 'Broad', 1_500_000, 0.2)],
    campaigns: [campaign('c1', 'Prospecting', { budgetMode: 'cbo', dailyBudget: 6000 })],
    adSets: [adSet('as1', 'c1', 'A', 'aud'), adSet('as2', 'c1', 'B', 'aud')],
    ads: [ad('ad1', 'as1', 'Ad A', 'cr-ugc-street'), ad('ad2', 'as2', 'Ad B', 'cr-offer-slab')],
  });
  const a = JSON.stringify(run(build(), 30, OPTS).results);
  const b = JSON.stringify(run(build(), 30, OPTS).results);
  check('same seed and actions reproduce identical output', a === b,
    `${a.length} chars compared byte for byte`);

  const c = JSON.stringify(run(build(), 30, { ...OPTS, seed: OPTS.seed + 1 }).results);
  check('a different seed produces a different run', a !== c, 'seeds are actually load-bearing');
}

// ────────────────────────────────────────────────────────── 9. sanity guards ──

section('Engine — invariants hold');
{
  const s = state({
    audiences: [audience('aud', 'Tiny', 5_000, 0.9)],
    campaigns: [campaign('c1', 'Retargeting', { strategyTag: 'retargeting' })],
    adSets: [adSet('as1', 'c1', 'Tiny pool', 'aud', { dailyBudget: 4000 })],
    ads: [ad('ad1', 'as1', 'Ad', 'cr-retarget-nudge')],
  });
  const out = run(s, 60, OPTS);
  const rt = out.state.adSets[0].runtime;

  check('reach never exceeds the audience', rt.reach <= 5_000, `reach ${rt.reach} of 5,000`);
  check('clicks never exceed impressions', rt.clicks <= rt.impressions, `${rt.clicks} <= ${rt.impressions}`);
  check('purchases never exceed clicks', rt.purchases <= rt.clicks, `${rt.purchases} <= ${rt.clicks}`);
  check('a paused ad set spends nothing', (() => {
    const paused = structuredClone(s);
    paused.adSets[0].status = 'paused';
    return run(paused, 7, OPTS).state.adSets[0].runtime.spend === 0;
  })(), 'status is respected');
  check('an ad set with no live ads spends nothing', (() => {
    const noAds = structuredClone(s);
    noAds.ads[0].status = 'paused';
    return run(noAds, 7, OPTS).state.adSets[0].runtime.spend === 0;
  })(), 'nothing to deliver means nothing to buy');
}

// ──────────────────────────────────────────────── 10. the edit choke point (6.3) ──

section('Module 6.3 — significant edits reset learning, cosmetic ones do not');
{
  const build = () => state({
    audiences: [
      audience('aud', 'Broad', 2_000_000, 0.1),
      audience('aud2', 'Other broad', 2_000_000, 0.1),
    ],
    campaigns: [campaign('c1', 'Prospecting')],
    adSets: [adSet('as1', 'c1', 'Set', 'aud', { dailyBudget: 3000 })],
    ads: [ad('ad1', 'as1', 'Ad', 'cr-ugc-street')],
  });
  // Run it to stability first: a reset only means something if there was progress.
  const settled = run(build(), 14, OPTS).state;
  const settledEvents = settled.adSets[0].runtime.trailingEvents.length;
  check('the ad set accumulated learning progress', settledEvents > 0,
    `${settledEvents} days of trailing events before any edit`);

  const cosmetic = applyEdit(settled, { kind: 'rename', level: 'adset', id: 'as1', name: 'Renamed' });
  check('renaming resets nothing', cosmetic.resetAdSetIds.length === 0, 'a name is not a delivery signal');

  const nudge = applyEdit(settled, { kind: 'setAdSetBudget', id: 'as1', dailyBudget: 3450 }); // +15%
  check('a ~15% budget nudge resets nothing', nudge.resetAdSetIds.length === 0,
    '₹3000 -> ₹3450 stays under the significance threshold');

  const jump = applyEdit(settled, { kind: 'setAdSetBudget', id: 'as1', dailyBudget: 9000 }); // +200%
  check('a 3x budget jump resets learning', jump.resetAdSetIds.includes('as1'),
    '₹3000 -> ₹9000 is a significant change');
  check('the reset actually clears accumulated progress',
    jump.state.adSets[0].runtime.trailingEvents.length === 0, 'trailing window emptied');

  const swap = applyEdit(settled, { kind: 'setAudience', id: 'as1', audienceId: 'aud2' });
  check('changing the audience resets learning', swap.resetAdSetIds.includes('as1'), 'a new pool is a new problem');
  check('changing the audience clears reach', swap.state.adSets[0].runtime.reach === 0,
    'accumulated reach described the old pool');

  const creative = applyEdit(settled, { kind: 'setAdCreative', id: 'ad1', creativeId: 'cr-offer-slab', format: 'image' });
  check('swapping creative resets learning', creative.resetAdSetIds.includes('as1'), 'new creative, new delivery');
  check('the new creative starts un-fatigued', creative.state.ads[0].runtime.impressions === 0,
    'fatigue belongs to the asset, not the slot');

  // previewReset must agree with what applyEdit actually does, or the UI warns
  // about the wrong thing.
  const predicted = previewReset(settled, { kind: 'setAdSetBudget', id: 'as1', dailyBudget: 9000 });
  check('previewReset agrees with applyEdit', predicted.join() === jump.resetAdSetIds.join(),
    `predicted [${predicted}], applied [${jump.resetAdSetIds}]`);
}

section('Module 7.2 — a duplicate is a new ad set, not a free stabilised one');
{
  const settled = run(state({
    audiences: [audience('aud', 'Broad', 2_000_000, 0.1), audience('fresh', 'Fresh pool', 2_000_000, 0.1)],
    campaigns: [campaign('c1', 'Prospecting')],
    adSets: [adSet('as1', 'c1', 'Winner', 'aud', { dailyBudget: 4000 })],
    ads: [ad('ad1', 'as1', 'Ad', 'cr-ugc-street')],
  }), 21, OPTS).state;

  const dup = applyEdit(settled, {
    kind: 'duplicateAdSet', id: 'as1', newId: 'as2', name: 'Winner (copy)',
    audienceId: 'fresh', newAdIds: ['ad2'],
  });
  const copy = dup.state.adSets.find((a) => a.id === 'as2');

  check('the copy inherits settings', copy?.dailyBudget === 4000, `₹${copy?.dailyBudget}/day, same as the original`);
  check('the copy starts from zero spend', copy?.runtime.spend === 0, 'no inherited delivery history');
  check('the copy starts in learning', copy?.runtime.learningState === 'learning',
    'a duplicate has to earn its own stability');
  check('the copy carries its own ad', dup.state.ads.some((a) => a.id === 'ad2' && a.adSetId === 'as2'),
    'ads are duplicated alongside the ad set');
}

// ──────────────────────────────────────────── 10b. breakdowns are measured ──
//
// The dashboard tells a learner that every age band, gender and placement buys at
// its own price and converts at its own rate, and that the three splits are the
// same delivery so they all add back to the total. Both halves are claims about
// the engine, so both are checked here. A breakdown that quietly stopped
// reconciling would teach someone to distrust numbers that were correct.

section('Breakdowns — the same delivery, sliced, and it adds up');
{
  const s = state({
    audiences: [audience('aud', 'Broad', 2_000_000, 0.2, {
      spec: { ageMin: 18, ageMax: 65, genders: 'all', geos: ['IN'], interests: [] },
    })],
    campaigns: [campaign('c1', 'Prospecting')],
    adSets: [adSet('as1', 'c1', 'Broad', 'aud', { dailyBudget: 6_000 })],
    ads: [ad('ad1', 'as1', 'UGC', 'cr-ugc-street', { format: 'video' })],
  });
  const { results } = run(s, 14, OPTS);

  // Reconciliation, on every day and every dimension, not just in aggregate.
  let mismatches = 0;
  for (const r of results) {
    for (const a of r.adSets) {
      for (const dim of SEGMENT_DIMENSIONS) {
        const rows = a.segments.filter((x) => x.dimension === dim);
        if (rows.length === 0) continue;
        const total = (f: (x: (typeof rows)[number]) => number) => rows.reduce((n, x) => n + f(x), 0);
        if (total((x) => x.spend) !== a.spend) mismatches++;
        if (total((x) => x.impressions) !== a.impressions) mismatches++;
        if (total((x) => x.linkClicks) !== a.linkClicks) mismatches++;
        if (total((x) => x.purchases) !== a.purchases) mismatches++;
        if (total((x) => x.revenue) !== a.revenue) mismatches++;
      }
    }
  }
  check('every dimension sums back to its ad set, every day', mismatches === 0,
    `${results.length} days x ${SEGMENT_DIMENSIONS.length} dimensions, ${mismatches} mismatched totals`);

  // Rates genuinely differ, which is the whole reason a breakdown is worth reading.
  const merged = mergeSegments(results.map((r) => r.adSets[0].segments));
  const seg = (key: string) => merged.find((x) => x.segment === key)!;
  const segCpm = (key: string) => (seg(key).spend / Math.max(1, seg(key).impressions)) * 1000;
  const segCvr = (key: string) =>
    (seg(key).purchases / Math.max(1, seg(key).linkClicks)) * 100;
  const segRoas = (key: string) => seg(key).revenue / Math.max(1, seg(key).spend);

  check('Audience Network is the cheapest inventory in the account',
    segCpm('Audience Network') < segCpm('Instagram Feed') * 0.6,
    `₹${segCpm('Audience Network').toFixed(0)} vs ₹${segCpm('Instagram Feed').toFixed(0)} on Instagram Feed`);
  // The cheap CPM is not free money: netted against the conversion rate it is the
  // worst return in the account, which is the entire reason to open this tab.
  const placementRoas = PLACEMENTS.map((p) => segRoas(p));
  check('and the worst value in the account, once its CPM is netted off',
    segRoas('Audience Network') === Math.min(...placementRoas)
    && segRoas('Audience Network') < segRoas('Facebook Feed') * 0.6,
    `${segRoas('Audience Network').toFixed(2)}x, lowest of ${PLACEMENTS.length} placements, ` +
    `against ${segRoas('Facebook Feed').toFixed(2)}x on Facebook Feed`);
  check('older bands cost more per thousand', segCpm('45–54') > segCpm('18–24') * 1.3,
    `₹${segCpm('45–54').toFixed(0)} vs ₹${segCpm('18–24').toFixed(0)}`);
  check('and convert better, so CPM alone reads backwards',
    segCvr('45–54') > segCvr('18–24') * 1.3,
    `${segCvr('45–54').toFixed(2)}% vs ${segCvr('18–24').toFixed(2)}%`);

  // Targeting has to actually shape the breakdown, or it is decoration.
  const narrow = structuredClone(s);
  narrow.audiences[0].spec = { ageMin: 18, ageMax: 34, genders: 'women', geos: ['IN'], interests: [] };
  const narrowSegments = mergeSegments(run(narrow, 7, OPTS).results.map((r) => r.adSets[0].segments));
  check('an excluded age band produces no rows at all',
    !narrowSegments.some((x) => ['35–44', '45–54', '55+'].includes(x.segment)),
    `18-34 targeting shows ${narrowSegments.filter((x) => x.dimension === 'age').map((x) => x.segment).join(', ')}`);
  check('and an excluded gender likewise',
    !narrowSegments.some((x) => x.segment === 'Men'),
    'women-only targeting shows only the Women row');

  // The placement lever has to be worth pulling, in both directions.
  const manual = structuredClone(s);
  manual.adSets[0].advantagePlacements = false;
  const manualRun = run(manual, 14, OPTS).results;
  const advRun = results;
  const manualSegments = mergeSegments(manualRun.map((r) => r.adSets[0].segments));
  check('dropping Advantage+ placements drops Audience Network with it',
    !manualSegments.some((x) => x.segment === 'Audience Network'),
    `manual placements deliver on ${manualSegments.filter((x) => x.dimension === 'placement').length} placements`);
  check('which costs more per thousand', cpmOf(manualRun) > cpmOf(advRun) * 1.05,
    `₹${cpmOf(manualRun).toFixed(0)} manual vs ₹${cpmOf(advRun).toFixed(0)} on Advantage+`);
  check('and is worth it, because the traffic converts', cvrOf(manualRun) > cvrOf(advRun) * 1.05,
    `${cvrOf(manualRun).toFixed(2)}% manual vs ${cvrOf(advRun).toFixed(2)}% on Advantage+`);
}

// ────────────────────────────────────────── 11. the sandbox account's design ──
//
// The starting account claims, in its own docblock, to contain specific teachable
// flaws. Those claims are load-bearing: the whole point of handing a learner an
// imperfect account is that advancing the clock without intervening should visibly
// go wrong. Asserting it here stops the scenario from quietly becoming benign if
// the model is retuned later.

section('Sandbox — the starting account contains its intended lessons');
{
  const sandbox = buildSandboxAccount();
  check('opens with a recognisable multi-campaign account',
    sandbox.campaigns.length === 4 && sandbox.adSets.length === 9 && sandbox.ads.length === 11,
    `${sandbox.campaigns.length} campaigns, ${sandbox.adSets.length} ad sets, ${sandbox.ads.length} ads`);

  const out = run(sandbox, 42, OPTS);
  const byId = new Map(out.state.adSets.map((a) => [a.id, a]));

  // The under-funded retargeting ad set should still be stuck.
  const video = byId.get('as-video');
  check('the under-funded ad set is stranded in Learning Limited',
    video?.runtime.learningState === 'limited',
    `as-video at ₹400/day is "${video?.runtime.learningState}"`);

  // The small warm pool should saturate: frequency well past the fatigue onset.
  const cart = byId.get('as-cart');
  const cartFreq = cart && cart.runtime.reach > 0 ? cart.runtime.impressions / cart.runtime.reach : 0;
  check('the small retargeting pool saturates', cartFreq > 3,
    `cart abandoners at ${cartFreq.toFixed(1)}x frequency`);

  const early = out.results.slice(0, 5);
  const late = out.results.slice(-5);

  // The interest stack's single hard-sell creative should visibly burn out, and the
  // sandbox's docblock says so, so it has to be true. Checked as the whole arc
  // rather than one number: a creative that merely got worse is not the lesson —
  // the lesson is one that *worked first*, which is why buyers keep being fooled.
  const interestWeek = (from: number, to: number) => {
    let impressions = 0, clicks = 0, spend = 0, revenue = 0, purchases = 0;
    for (const r of out.results.slice(from, to)) {
      for (const a of r.adSets) {
        if (a.adSetId !== 'as-interest') continue;
        impressions += a.impressions; clicks += a.linkClicks;
        spend += a.spend; revenue += a.revenue; purchases += a.purchases;
      }
    }
    return {
      ctr: (clicks / Math.max(1, impressions)) * 100,
      roas: revenue / Math.max(1, spend),
      cpa: purchases > 0 ? spend / purchases : Infinity,
    };
  };
  const w1 = interestWeek(0, 7), w2 = interestWeek(7, 14), w6 = interestWeek(35, 42);

  const interest = byId.get('as-interest');
  const offer = out.state.ads.find((a) => a.id === 'ad-int-offer');
  const offerFreq = interest && offer && interest.runtime.reach > 0
    ? offer.runtime.impressions / interest.runtime.reach : 0;

  check('the lone hard-sell creative saturates its pool', offerFreq > 2.5,
    `ad-int-offer at ${offerFreq.toFixed(2)}x frequency after six weeks`);
  check('and its click-through collapses with it', w6.ctr < w1.ctr * 0.7,
    `CTR ${w1.ctr.toFixed(2)}% -> ${w6.ctr.toFixed(2)}% (${(((w6.ctr - w1.ctr) / w1.ctr) * 100).toFixed(0)}%)`);
  check('the burn costs real money, not just clicks', w6.cpa > w1.cpa * 1.4,
    `CPA ₹${w1.cpa.toFixed(0)} -> ₹${w6.cpa.toFixed(0)}`);
  check('it works before it fails, which is what makes it a trap',
    w2.roas > w1.roas && w2.roas > 2 && w6.roas < 1.3,
    `ad set ROAS ${w1.roas.toFixed(2)}x -> ${w2.roas.toFixed(2)}x (peak) -> ${w6.roas.toFixed(2)}x`);

  // The two-creative lookalike next door should NOT burn, so the learner has a
  // controlled comparison rather than an account where everything is dying.
  const lookalike = byId.get('as-lookalike');
  const lalFreq = lookalike && lookalike.runtime.reach > 0
    ? lookalike.runtime.impressions / lookalike.runtime.reach : 0;
  check('the ad set beside it does not, so the difference is diagnosable',
    lalFreq < MODEL.fatigueOnsetFrequency,
    `as-lookalike at ${lalFreq.toFixed(2)}x frequency, below the ${MODEL.fatigueOnsetFrequency}x onset`);

  // CBO should already be concentrating inside the Advantage+ campaign.
  const advYoung = byId.get('as-adv-young')?.runtime.spend ?? 0;
  const advOlder = byId.get('as-adv-older')?.runtime.spend ?? 0;
  const advTotal = advYoung + advOlder;
  const advTop = Math.max(advYoung, advOlder) / Math.max(1, advTotal);
  check('CBO has already picked a favourite in the Advantage+ campaign', advTop > 0.6,
    `${(advTop * 100).toFixed(0)}% of that campaign's spend went to one ad set`);

  // And doing nothing at all should be visibly worse by the end than at the start.
  const roasEarly = sum(early, (r) => r.account.revenue) / Math.max(1, sum(early, (r) => r.account.spend));
  const roasLate = sum(late, (r) => r.account.revenue) / Math.max(1, sum(late, (r) => r.account.spend));
  check('leaving the account untouched degrades it', roasLate < roasEarly,
    `ROAS ${roasEarly.toFixed(2)}x -> ${roasLate.toFixed(2)}x over six weeks of doing nothing`);
}

// ────────────────────────────────────────────────────────────────── report ──

console.log(notes.join('\n'));
if (failures.length > 0) {
  console.error(`\n${failures.length} calibration failure(s):\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`\nSimulator calibration passed: ${notes.filter((n) => n.startsWith('  ok')).length} checks.`);
