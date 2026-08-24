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

import { run, tick, type DayResult } from '../src/lib/simulator/engine';
import { resolveCreative } from '../src/lib/simulator/creatives';
import { ad, adSet, audience, campaign, state } from '../src/lib/simulator/factory';

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
    // A small pool so saturation arrives inside the test window.
    audiences: [audience('aud', 'Narrow interest', 120_000, 0.2)],
    campaigns: [campaign('c1', 'Prospecting')],
    adSets: [adSet('as1', 'c1', 'Interest', 'aud', { dailyBudget: 3500 })],
    ads: [ad('ad1', 'as1', 'Offer slab', 'cr-offer-slab')],
  });
  const { results } = run(s, 30, OPTS);
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
  const durableLate = run(durable, 30, OPTS).results.slice(-5);
  check('durable creative outlasts the offer slab', ctrOf(durableLate) > ctrOf(late),
    `UGC ${ctrOf(durableLate).toFixed(2)}% vs slab ${ctrOf(late).toFixed(2)}% at day 30`);
}

// ──────────────────────────────────────── 3. learning phase & the 50-event rule ──
//
// Module 4.2's own scenario, playable: eight ad sets at ₹15/day are all starved;
// consolidating the same total budget into three lets each clear the threshold.

section('Module 4.2 — consolidation escapes Learning Limited');
{
  // Sized against the model's own measured economics on this audience (~₹250 a
  // purchase): clearing 50 events in 7 days takes roughly ₹2,000/day. The same
  // ₹7,500 split eight ways gives ₹937 each and strands all of them; split three
  // ways it gives ₹2,500 each, which clears the threshold comfortably.
  const TOTAL = 7_500;

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

  // Settle first, so both arms start from a stabilised ad set.
  const settled = run(build(), 14, OPTS).state;

  // Both arms must finish at the SAME daily budget, otherwise this measures the
  // cost of scale rather than the cost of how you got there. Seven ~20% steps land
  // on 1.2^7 of the starting budget, so the jump arm goes straight to that figure.
  const START = 2000;
  const TARGET = Math.round(START * 1.2 ** 7);

  const jumped = structuredClone(settled);
  jumped.adSets[0].dailyBudget = TARGET; // the whole increase, overnight
  jumped.adSets[0].runtime.learningResetDay = jumped.day; // a significant edit resets learning
  jumped.adSets[0].runtime.trailingEvents = [];
  const jumpedOut = run(jumped, 14, OPTS);

  let steppedState = structuredClone(settled);
  const steppedResults: DayResult[] = [];
  // ~20% every other day: each step stays under the significance threshold, so
  // delivery is never knocked back into learning.
  for (let d = 0; d < 14; d++) {
    if (d % 2 === 0) {
      const cur = steppedState.adSets[0].dailyBudget ?? START;
      steppedState.adSets[0].dailyBudget = Math.min(TARGET, Math.round(cur * 1.2));
    }
    const step = tick(steppedState, OPTS);
    steppedState = step.state;
    steppedResults.push(step.result);
  }

  // Measured over the scaling fortnight only. Reading the entities' cumulative
  // runtime instead would blend in the 14 settled days both arms share, which
  // dilutes the very difference this check exists to detect.
  const cpaOver = (rs: DayResult[]) =>
    sum(rs, (r) => r.account.spend) / Math.max(1, sum(rs, (r) => r.account.purchases));
  const jumpedCpa = cpaOver(jumpedOut.results);
  const steppedCpa = cpaOver(steppedResults);

  const jBudget = jumpedOut.state.adSets[0].dailyBudget ?? 0;
  const sBudget = steppedState.adSets[0].dailyBudget ?? 0;
  check('both arms finish at the same daily budget', Math.abs(jBudget - sBudget) <= 2,
    `₹${jBudget} vs ₹${sBudget}/day, so this compares method not scale`);
  check('the overnight jump lands a worse CPA than stepped scaling',
    jumpedCpa > steppedCpa * 1.05,
    `jump ₹${jumpedCpa.toFixed(0)} vs stepped ₹${steppedCpa.toFixed(0)} per purchase over the same fortnight`);
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

// ────────────────────────────────────────────────────────────────── report ──

console.log(notes.join('\n'));
if (failures.length > 0) {
  console.error(`\n${failures.length} calibration failure(s):\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`\nSimulator calibration passed: ${notes.filter((n) => n.startsWith('  ok')).length} checks.`);
