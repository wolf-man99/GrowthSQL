/**
 * Google Ads simulator calibration gate.
 *
 * The Run tier's claim is that everything Learn teaches is something the account
 * actually does. That claim is only true if the model behaves the way search
 * advertising behaves, so this asserts exactly that, module by module.
 *
 * These are behavioural assertions rather than snapshots: they check relationships
 * ("quality divides cost", "negatives do not expand to synonyms") and not exact
 * figures, so the constants in engine/types.ts can be retuned without rewriting the
 * suite. Two exceptions, both deliberate — the determinism check pins exact output
 * against a rerun of the engine itself, and the economics check pins the account's
 * results against its own break-even, which is arithmetic rather than tuning.
 *
 * Several checks assert that a *wrong* instinct fails. Those matter most. A
 * simulator in which every plausible action improves things teaches nothing, and a
 * mission it is possible to pass by doing nothing is not a mission.
 *
 * Run: npx tsx scripts/validate-gsim.ts
 */

import {
  APP_CHANNELS, GMODEL, G_HOUR_CUMULATIVE, conceptsOf, dayShareAt, drawSearchTime,
  matchKeyword, negativeBlocks, resolveAuction, run, tick,
  type GDayResult, type GState, type SearchQuery,
} from '../src/lib/gsim/engine';
import {
  accountFor, ad, adGroup, applyEdit, campaign, keyword, negative,
} from '../src/lib/gsim/state';
import { buildD2CStartingAccount } from '../src/lib/gsim/scenarios/d2c-starting';
import { buildD2CFixedAccount } from '../src/lib/gsim/scenarios/d2c-fixed';
import {
  buildAppStartingAccount, buildAppFixedAccount, NORTHBOUND_APP,
} from '../src/lib/gsim/scenarios/app-starting';
import { VERTICALS } from '../src/lib/gsim/verticals';

const SEED = 20260903;

const failures: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail: string) {
  (condition ? notes : failures).push(`  ${condition ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
}

function section(title: string) {
  notes.push(`\n${title}`);
}

// ────────────────────────────────────────────────────────────────── helpers ──

interface Totals {
  impressions: number; clicks: number; cost: number; conversions: number; convValue: number;
}

const zero = (): Totals =>
  ({ impressions: 0, clicks: 0, cost: 0, conversions: 0, convValue: 0 });

function sum(results: GDayResult[]): Totals {
  return results.reduce((a, r) => ({
    impressions: a.impressions + r.account.impressions,
    clicks: a.clicks + r.account.clicks,
    cost: a.cost + r.account.cost,
    conversions: a.conversions + r.account.conversions,
    convValue: a.convValue + r.account.convValue,
  }), zero());
}

const cpa = (t: Totals) => (t.conversions > 0 ? t.cost / t.conversions : Infinity);
const roas = (t: Totals) => (t.cost > 0 ? t.convValue / t.cost : 0);
const ctr = (t: Totals) => (t.impressions > 0 ? t.clicks / t.impressions : 0);
const cpc = (t: Totals) => (t.clicks > 0 ? t.cost / t.clicks : 0);
const inr = (n: number) => (Number.isFinite(n) ? `₹${Math.round(n).toLocaleString('en-IN')}` : '—');
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

/** Everything one keyword did across a run. */
function keywordTotals(results: GDayResult[], keywordId: string) {
  const t = { ...zero(), eligible: 0, lostToRank: 0, lostToBudget: 0, top: 0, absTop: 0, qs: [] as number[] };
  for (const r of results) {
    for (const k of r.keywords) {
      if (k.keywordId !== keywordId) continue;
      t.impressions += k.impressions; t.clicks += k.clicks; t.cost += k.cost;
      t.conversions += k.conversions; t.convValue += k.convValue;
      t.eligible += k.eligible; t.lostToRank += k.lostToRank; t.lostToBudget += k.lostToBudget;
      t.top += k.topImpressions; t.absTop += k.absTopImpressions;
      if (k.qualityScore > 0) t.qs.push(k.qualityScore);
    }
  }
  return t;
}

function campaignTotals(results: GDayResult[], campaignId: string): Totals {
  const t = zero();
  for (const r of results) {
    for (const c of r.campaigns) {
      if (c.campaignId !== campaignId) continue;
      t.impressions += c.impressions; t.clicks += c.clicks; t.cost += c.cost;
      t.conversions += c.conversions; t.convValue += c.convValue;
    }
  }
  return t;
}

/** Distinct search terms a run produced, with what each of them cost. */
function terms(results: GDayResult[]): Map<string, Totals & { text: string }> {
  const out = new Map<string, Totals & { text: string }>();
  for (const r of results) {
    for (const s of r.searchTerms) {
      const e = out.get(s.queryId) ?? { ...zero(), text: s.text };
      e.impressions += s.impressions; e.clicks += s.clicks; e.cost += s.cost;
      e.conversions += s.conversions; e.convValue += s.convValue;
      out.set(s.queryId, e);
    }
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * A one-keyword account, for controlled experiments.
 *
 * Isolating a single keyword against a single query is the only way to assert
 * something like "quality divides cost" honestly. Measured across a whole account
 * the claim drowns in mix effects — a better-built account also buys *different*
 * queries — and a check that cannot fail for the right reason is not a check.
 */
function lab(opts: {
  queries: SearchQuery[];
  keywordText: string;
  match: 'exact' | 'phrase' | 'broad';
  bid: number;
  headlines: string[];
  landingPageQuality: number;
  budget?: number;
  negatives?: { text: string; match?: 'exact' | 'phrase' | 'broad' }[];
}): GState {
  const state = accountFor('d2c');
  state.queries = opts.queries;
  state.campaigns = [campaign({ id: 'lab-c', name: 'Lab', dailyBudget: opts.budget ?? 100_000 })];
  state.adGroups = [adGroup({
    id: 'lab-g', campaignId: 'lab-c', name: 'Lab',
    defaultCpc: opts.bid, landingPageQuality: opts.landingPageQuality,
  })];
  state.keywords = [keyword({
    id: 'lab-k', adGroupId: 'lab-g', text: opts.keywordText, match: opts.match, maxCpc: opts.bid,
  })];
  state.ads = [ad({
    id: 'lab-a', adGroupId: 'lab-g', headlines: opts.headlines,
    descriptions: [opts.headlines.join('. ') + '.'],
  })];
  state.negatives = (opts.negatives ?? []).map((n, i) =>
    negative({ id: `lab-n${i}`, level: 'account', text: n.text, match: n.match ?? 'phrase' }));
  return state;
}

const Q = VERTICALS.d2c.queries;
const findQ = (id: string) => Q.find((q) => q.id === id)!;

// ═════════════════════════════════════════════════════ 1. Determinism ═══════

section('Determinism — a run has to be replayable or nothing below means anything');
{
  const a = run(buildD2CStartingAccount(), 10, { seed: SEED });
  const b = run(buildD2CStartingAccount(), 10, { seed: SEED });
  check('identical seed reproduces identical output',
    JSON.stringify(a.results) === JSON.stringify(b.results),
    `${a.results.length} days compared byte for byte`);

  const c = run(buildD2CStartingAccount(), 10, { seed: SEED + 1 });
  check('a different seed produces a different run',
    JSON.stringify(a.results) !== JSON.stringify(c.results),
    'seeds are actually used');

  const pure = buildD2CStartingAccount();
  const before = JSON.stringify(pure);
  tick(pure, { seed: SEED });
  check('tick does not mutate the state it was given',
    JSON.stringify(pure) === before,
    'the engine is pure, so a UI can hold one state and preview against it');
}

// ══════════════════════════════════════════ 2. Matching and search terms ════

section('Module 2 — match types, search terms, negatives');
{
  const broadReach = Q.filter((q) => matchKeyword(
    { id: 'x', adGroupId: 'g', text: 'running shoes', match: 'broad', status: 'active', createdDay: 0,
      runtime: { impressions: 0, clicks: 0, cost: 0, conversions: 0, convValue: 0, ctrEma: 0, ctrSamples: 0, eligibleAuctions: 0, lostToRank: 0, lostToBudget: 0, state: 'eligible' } }, q).matched);
  const phraseReach = Q.filter((q) => matchKeyword(
    { id: 'x', adGroupId: 'g', text: 'running shoes', match: 'phrase', status: 'active', createdDay: 0,
      runtime: { impressions: 0, clicks: 0, cost: 0, conversions: 0, convValue: 0, ctrEma: 0, ctrSamples: 0, eligibleAuctions: 0, lostToRank: 0, lostToBudget: 0, state: 'eligible' } }, q).matched);

  check('broad match reaches strictly further than phrase',
    broadReach.length > phraseReach.length * 1.3,
    `broad ${broadReach.length} queries, phrase ${phraseReach.length}`);

  const broadOnly = broadReach.filter((q) => !phraseReach.includes(q));
  const broadOnlyCvr = avg(broadOnly.map((q) => q.cvrMultiplier));
  const phraseCvr = avg(phraseReach.map((q) => q.cvrMultiplier));
  check('and what it reaches out there converts worse',
    broadOnlyCvr < phraseCvr * 0.75,
    `broad-only queries average ${broadOnlyCvr.toFixed(2)}× conversion rate, phrase ${phraseCvr.toFixed(2)}×`);

  // The single most-missed fact about negative keywords.
  const neg = negative({ id: 'n', level: 'account', text: 'cheap', match: 'broad' });
  const cheapQuery: SearchQuery = {
    id: 'z', text: 'affordable running shoes', volume: 10, intent: 'commercial',
    concepts: ['affordable', 'running', 'shoes'], cvrMultiplier: 1, competition: 1,
  };
  check('a negative does NOT expand to synonyms',
    !negativeBlocks(neg, cheapQuery),
    'negating "cheap" leaves "affordable" running — the asymmetry that catches everyone');
  check('a negative does block the term it names',
    negativeBlocks(neg, { ...cheapQuery, concepts: ['cheap', 'running', 'shoes'] }),
    'literal matching still works');

  // A phrase negative needs its words in order; a broad one does not.
  const phraseNeg = negative({ id: 'n2', level: 'account', text: 'shoe repair', match: 'phrase' });
  check('phrase negatives respect word order',
    negativeBlocks(phraseNeg, { ...cheapQuery, concepts: ['shoe', 'repair', 'near', 'me'] })
    && !negativeBlocks(phraseNeg, { ...cheapQuery, concepts: ['repair', 'my', 'shoe'] }),
    'blocks "shoe repair near me", not "repair my shoe"');
}

{
  // The report exists to show you what you actually bought, not what you asked for.
  const { results } = run(buildD2CStartingAccount(), 14, { seed: SEED });
  const bought = terms(results);
  const keywordTexts = new Set(buildD2CStartingAccount().keywords.map((k) => k.text));
  const unasked = [...bought.values()].filter((t) => !keywordTexts.has(t.text));

  check('the search terms report shows terms nobody added as keywords',
    unasked.length > 25,
    `${unasked.length} of ${bought.size} terms were never in the keyword list`);

  const wasted = [...bought.values()].filter((t) => t.conversions === 0)
    .reduce((n, t) => n + t.cost, 0);
  const total = sum(results).cost;
  check('and a broad-match account spends a large share on terms that never convert',
    wasted / total > 0.4,
    `${inr(wasted)} of ${inr(total)} — ${(wasted / total * 100).toFixed(0)}% — bought nothing`);

  // Specific waste the curriculum names by hand.
  for (const id of ['w1', 'w11', 'w12']) {
    const q = findQ(id);
    check(`broad match reaches "${q.text}"`, bought.has(id),
      bought.has(id) ? `${inr(bought.get(id)!.cost)} spent on it` : 'never appeared');
  }
}

{
  // Negatives are not a tidiness exercise: they move budget.
  const queries = Q.filter((q) => ['g2', 'w1', 'w3', 'w6', 't1', 'c2'].includes(q.id));
  const loose = lab({
    queries, keywordText: 'running shoes', match: 'broad', bid: 60,
    headlines: ['Running Shoes Online'], landingPageQuality: 1, budget: 2200,
  });
  const fenced = lab({
    queries, keywordText: 'running shoes', match: 'broad', bid: 60,
    headlines: ['Running Shoes Online'], landingPageQuality: 1, budget: 2200,
    negatives: [{ text: 'repair' }, { text: 'free' }, { text: 'jobs' }],
  });

  const l = sum(run(loose, 14, { seed: SEED }).results);
  const f = sum(run(fenced, 14, { seed: SEED }).results);

  check('negatives improve cost per conversion at the same budget',
    cpa(f) < cpa(l) * 0.85,
    `${inr(cpa(l))} → ${inr(cpa(f))} on ${inr(l.cost)} vs ${inr(f.cost)}`);
  check('and they do it by redirecting spend, not by spending less',
    f.conversions > l.conversions,
    `${l.conversions} → ${f.conversions} conversions`);
}

// ═══════════════════════════════════════ 3. Quality Score and the auction ═══

section('Module 3 — Ad Rank, Quality Score, and what a click costs');
{
  const queries = [findQ('c2'), findQ('c4')];
  const common = { queries, keywordText: 'trail running shoes', match: 'phrase' as const, bid: 70 };

  const sloppy = lab({
    ...common,
    headlines: ['Shop Our Store', 'Free Shipping Across India', 'New Season Arrivals'],
    landingPageQuality: 0.7,
  });
  const sharp = lab({
    ...common,
    headlines: ['Trail Running Shoes', 'Waterproof Trail Shoes', 'Trail Running Shoes Online'],
    landingPageQuality: 1.2,
  });

  const s = run(sloppy, 14, { seed: SEED });
  const t = run(sharp, 14, { seed: SEED });
  const sk = keywordTotals(s.results, 'lab-k');
  const tk = keywordTotals(t.results, 'lab-k');

  check('a relevant ad and a matching landing page raise Quality Score',
    avg(tk.qs) > avg(sk.qs) + 1.5,
    `QS ${avg(sk.qs).toFixed(1)} → ${avg(tk.qs).toFixed(1)} at an identical ₹70 bid`);
  {
    // Tested at the primitive, because at account level the claim gets tangled
    // with a second true thing: better quality also buys a *better slot*, and a
    // better slot costs more. Holding Ad Rank fixed separates them. Two bidders
    // at identical rank sit in identical positions — and the one who got there on
    // quality rather than on money pays less for it.
    const rivals = [180, 120, 96, 74, 55];
    const q = (factor: number) => ({
      score: Math.round(factor * 5.8), factor,
      detail: { expectedCtr: 'average' as const, adRelevance: 'average' as const, landingPage: 'average' as const },
    });
    const rank = 110;
    const poor = resolveAuction({ bid: rank / 0.6, quality: q(0.6), myRank: rank, rivalRanks: rivals, query: findQ('c2') });
    const good = resolveAuction({ bid: rank / 1.5, quality: q(1.5), myRank: rank, rivalRanks: rivals, query: findQ('c2') });
    check('quality divides what a click costs, at the same position',
      poor.position === good.position && good.cpc < poor.cpc * 0.75,
      `both land at position ${poor.position}; the ₹${Math.round(rank / 0.6)} bid at quality 0.6 pays `
      + `${inr(poor.cpc)}, the ₹${Math.round(rank / 1.5)} bid at quality 1.5 pays ${inr(good.cpc)}`);
  }
  // Note what does *not* change: impressions. Both ads clear the reserve and both
  // fit on a page with six slots, so quality does not buy more of the auction —
  // it buys a better place in it, and a better place is what earns the clicks.
  check('better quality buys far more clicks from the same impressions',
    tk.clicks > sk.clicks * 1.5 && cpc(tk) <= cpc(sk) * 1.05,
    `${sk.clicks.toLocaleString('en-IN')} → ${tk.clicks.toLocaleString('en-IN')} clicks from `
    + `${sk.impressions.toLocaleString('en-IN')} vs ${tk.impressions.toLocaleString('en-IN')} impressions, `
    + `at ${inr(cpc(sk))} → ${inr(cpc(tk))} per click`);
  check('and it buys a better position at that price',
    tk.absTop / Math.max(1, tk.impressions) > sk.absTop / Math.max(1, sk.impressions),
    `absolute top ${pct(sk.absTop / Math.max(1, sk.impressions))} → ${pct(tk.absTop / Math.max(1, tk.impressions))}`);

  // The claim that makes Ad Rank worth teaching at all.
  const cheapAndGood = lab({
    queries, keywordText: 'trail running shoes', match: 'phrase', bid: 52,
    headlines: ['Trail Running Shoes', 'Waterproof Trail Shoes', 'Trail Running Shoes Online'],
    landingPageQuality: 1.2,
  });
  const dearAndBad = lab({
    queries, keywordText: 'trail running shoes', match: 'phrase', bid: 78,
    headlines: ['Shop Our Store', 'Free Shipping Across India', 'New Season Arrivals'],
    landingPageQuality: 0.7,
  });
  const cg = keywordTotals(run(cheapAndGood, 14, { seed: SEED }).results, 'lab-k');
  const db = keywordTotals(run(dearAndBad, 14, { seed: SEED }).results, 'lab-k');

  check('a lower bid with better quality outranks a higher bid with worse',
    cg.absTop / Math.max(1, cg.impressions) > db.absTop / Math.max(1, db.impressions),
    `₹52 at good quality reaches absolute top ${pct(cg.absTop / Math.max(1, cg.impressions))}, `
    + `₹78 at poor quality ${pct(db.absTop / Math.max(1, db.impressions))}`);
  check('and pays less per click while doing it',
    cpc(cg) < cpc(db),
    `${inr(cpc(cg))} vs ${inr(cpc(db))}`);
}

{
  // Quality Score is not a profitability score. Accounts have high-scoring
  // keywords that lose money, and a learner who conflates the two optimises the
  // wrong number for a year.
  const { results } = run(buildD2CStartingAccount(), 14, { seed: SEED });
  const generic = keywordTotals(results, 'k-running-shoes');
  check('a high Quality Score does not mean a keyword is profitable',
    avg(generic.qs) >= 5 && cpa(generic) > VERTICALS.d2c.conditions.conversionValue * VERTICALS.d2c.conditions.margin,
    `"running shoes" scores ${avg(generic.qs).toFixed(1)}/10 and still costs ${inr(cpa(generic))} `
    + `per order against a ${inr(VERTICALS.d2c.conditions.conversionValue * VERTICALS.d2c.conditions.margin)} ceiling`);
}

{
  // Bidding your way out of a quality problem stops working, because the reserve
  // is a rank and not a price.
  const queries = [findQ('c2')];
  const awful = lab({
    queries, keywordText: 'trail running shoes', match: 'phrase', bid: 8,
    headlines: ['Shop Now'], landingPageQuality: 0.6,
  });
  const k = keywordTotals(run(awful, 7, { seed: SEED }).results, 'lab-k');
  check('below the reserve, an ad does not serve however many auctions it enters',
    k.eligible > 500 && k.impressions === 0,
    `${k.eligible.toLocaleString('en-IN')} auctions entered, ${k.impressions} impressions — `
    + '"rarely shown due to low Quality Score", with no competitor required');
}

// ═════════════════════════════════════════════ 4. Impression share, budget ══

section('Module 4 — impression share, and the two ways to lose it');
{
  const base = buildD2CStartingAccount();
  const poor = run(base, 14, { seed: SEED });
  const rich = run(applyEdit(base, { kind: 'campaign_budget', id: 'c-search', dailyBudget: 14_000 }, 0).state,
    14, { seed: SEED });

  const pk = keywordTotals(poor.results, 'k-running-shoes');
  const rk = keywordTotals(rich.results, 'k-running-shoes');

  check('a starved campaign loses most of its impressions to budget, not to rank',
    pk.lostToBudget > pk.lostToRank * 3,
    `lost to budget ${pk.lostToBudget.toLocaleString('en-IN')}, to rank ${pk.lostToRank.toLocaleString('en-IN')}`);
  check('raising the budget converts that loss into impressions',
    rk.impressions > pk.impressions * 1.8 && rk.lostToBudget < pk.lostToBudget * 0.7,
    `impressions ${pk.impressions.toLocaleString('en-IN')} → ${rk.impressions.toLocaleString('en-IN')}, `
    + `lost-to-budget ${pk.lostToBudget.toLocaleString('en-IN')} → ${rk.lostToBudget.toLocaleString('en-IN')}`);
  check('the three add up, because they are counted rather than estimated',
    poor.results.every((d) => d.keywords.every((k) =>
      k.impressions + k.lostToRank + k.lostToBudget === k.eligible)),
    'impressions + lost to rank + lost to budget = eligible auctions, every keyword, every day');

  // Buying more of a bad thing is still bad. The wrong instinct has to fail.
  const pt = sum(poor.results);
  const rt = sum(rich.results);
  check('but spending more on an unfixed account makes it worse, not better',
    cpa(rt) > cpa(pt) && roas(rt) < roas(pt),
    `CPA ${inr(cpa(pt))} → ${inr(cpa(rt))}, ROAS ${roas(pt).toFixed(2)} → ${roas(rt).toFixed(2)} `
    + 'at four times the budget');
}

{
  // Pacing: a budget has to run out through the day, not at the top of it.
  check('the hour curve is a real distribution',
    Math.abs(G_HOUR_CUMULATIVE[23] - 1) < 1e-9
    && dayShareAt(6) < 0.08 && dayShareAt(12) > 0.25 && dayShareAt(12) < 0.6
    && G_HOUR_CUMULATIVE.every((v, i) => i === 0 || v >= G_HOUR_CUMULATIVE[i - 1]),
    `${pct(dayShareAt(6))} of a day's searches by 6am, ${pct(dayShareAt(12))} by noon, monotone throughout`);
  check('search times are drawn from it',
    drawSearchTime(0.01) < 8 && drawSearchTime(0.5) > 10 && drawSearchTime(0.99) > 20,
    'early, middle and late draws land where the curve says they should');
}

// ══════════════════════════════════════════════ 5. Structure and economics ══

section('Modules 5–6 — structure, bidding, and whether any of it is worth doing');
{
  const before = run(buildD2CStartingAccount(), 21, { seed: SEED });
  const after = run(buildD2CFixedAccount(), 21, { seed: SEED });
  const b = sum(before.results);
  const a = sum(after.results);

  check('the two accounts spend roughly the same money',
    Math.abs(a.cost - b.cost) / b.cost < 0.12,
    `${inr(b.cost)} vs ${inr(a.cost)} over 21 days`);
  check('restructuring roughly halves cost per order',
    cpa(a) < cpa(b) * 0.6,
    `${inr(cpa(b))} → ${inr(cpa(a))}`);
  check('and roughly doubles orders on the same budget',
    a.conversions > b.conversions * 1.7,
    `${b.conversions} → ${a.conversions} orders`);
  check('click-through rises because the ads finally answer the searches',
    ctr(a) > ctr(b) * 1.8,
    `${pct(ctr(b))} → ${pct(ctr(a))}`);
  check('conversion rate rises because the searches are worth answering',
    a.conversions / a.clicks > (b.conversions / b.clicks) * 1.6,
    `${pct(b.conversions / b.clicks)} → ${pct(a.conversions / a.clicks)}`);

  const breakEven = 1 / VERTICALS.d2c.conditions.margin;
  check('the fixed account clears break-even with real headroom',
    roas(a) > breakEven * 2.5,
    `ROAS ${roas(a).toFixed(2)} against break-even ${breakEven.toFixed(2)}`);

  // The trap that makes blended reporting dangerous.
  const bBrand = before.results.flatMap((d) => d.keywords).filter((k) => k.keywordId === 'k-brand');
  const brandConv = bBrand.reduce((n, k) => n + k.conversions, 0);
  const brandCost = bBrand.reduce((n, k) => n + k.cost, 0);
  const nonBrand = { ...zero(), cost: b.cost - brandCost, conversions: b.conversions - brandConv };
  nonBrand.convValue = nonBrand.conversions * VERTICALS.d2c.conditions.conversionValue;
  check('and the broken account is only profitable because brand is hiding inside it',
    roas(b) > breakEven && roas(nonBrand) < breakEven,
    `blended ROAS ${roas(b).toFixed(2)}, non-brand ROAS ${roas(nonBrand).toFixed(2)}, break-even ${breakEven.toFixed(2)}`);
}

{
  // Bidding, and the two claims worth making about it.
  const manual = buildD2CFixedAccount();
  const m = campaignTotals(run(manual, 10, { seed: SEED }).results, 'c-nonbrand');
  const achieved = cpa(m);

  // First: a flat manual bid is a blunt instrument. One number per ad group cannot
  // tell a search that converts at three times the average from one that converts
  // at a fifth of it, so it necessarily overpays for the second to afford the
  // first. Anything that bids per-search beats it — which is the honest case for
  // automation, and a better one than the case usually made for it.
  const valued = applyEdit(manual, {
    kind: 'campaign_bid_strategy', id: 'c-nonbrand', bidStrategy: 'maximise_conversions',
  }, 0).state;
  const trained = structuredClone(valued);
  for (const c of trained.campaigns) {
    c.runtime.trailingConversions = Array.from({ length: 30 }, () => 4);
    c.runtime.strategyChangedDay = -30;
  }
  const v = campaignTotals(run(trained, 10, { seed: SEED }).results, 'c-nonbrand');
  check('bidding per search beats one flat bid per ad group',
    cpa(v) < achieved * 0.95 && v.conversions >= m.conversions,
    `manual ${m.conversions} conversions at ${inr(achieved)}; the same budget bid by value `
    + `returns ${v.conversions} at ${inr(cpa(v))}`);

  // Second: a target is a constraint, and the way a constraint gets honoured is by
  // not bidding. Whether that is good news depends on whether the account was
  // overpaying for inventory it could have had cheaper — which this one was. The
  // folk version ("an aggressive target destroys volume") is not reliably true and
  // the simulator should not pretend it is.
  const greedy = applyEdit(manual, {
    kind: 'campaign_bid_strategy', id: 'c-nonbrand',
    bidStrategy: 'target_cpa', targetCpa: Math.round(achieved * 0.45),
  }, 0).state;
  const g = campaignTotals(run(greedy, 10, { seed: SEED }).results, 'c-nonbrand');
  check('an aggressive Target CPA throttles delivery rather than finding a miracle',
    g.cost < m.cost * 0.75,
    `asking for ${inr(achieved * 0.45)} against an achieved ${inr(achieved)} cuts spend `
    + `${inr(m.cost)} → ${inr(g.cost)}; what survives is whatever met the target `
    + `(${g.conversions} conversions at ${inr(cpa(g))})`);
}

{
  // The learning period, measured where it exists.
  //
  // On the broad-match account, uncapped, over five days — the window in which a
  // cold strategy is actually cold. Maximise conversions considers itself informed
  // after fifteen conversions and an account this size earns those on the first
  // afternoon, so a fortnight-long comparison is thirteen days of two identical
  // strategies with one bad morning buried inside it.
  const broad = buildD2CStartingAccount();
  broad.campaigns[0].dailyBudget = 30_000;
  const cold = applyEdit(broad, {
    kind: 'campaign_bid_strategy', id: 'c-search', bidStrategy: 'maximise_conversions',
  }, 0).state;
  const warmed = structuredClone(cold);
  for (const c of warmed.campaigns) {
    c.runtime.trailingConversions = Array.from({ length: 30 }, () => 6);
    c.runtime.strategyChangedDay = -30;
  }

  const c0 = campaignTotals(run(cold, 5, { seed: SEED }).results, 'c-search');
  const w = campaignTotals(run(warmed, 5, { seed: SEED }).results, 'c-search');

  check('a cold strategy delivers fewer conversions than the same strategy trained',
    w.conversions > c0.conversions * 1.08,
    `${c0.conversions} conversions cold, ${w.conversions} with thirty days of history behind it`);

  // And the shape of the shortfall, which is what a learner will actually see:
  // not a disaster, a *dip*. Volume falls because the model has not yet worked out
  // that this account's traffic is better than the market average, so it bids
  // everything as though it were average and loses the auctions worth winning.
  check('and it under-delivers rather than overspending, which is what a learning period looks like',
    c0.cost < w.cost * 0.8 && cpa(c0) < cpa(w),
    `cold spends ${inr(c0.cost)} against ${inr(w.cost)} — a volume dip at a flattering `
    + `${inr(cpa(c0))} CPA, which is exactly why it gets mistaken for an improvement`);

  // Maximise clicks is the control: it never asks what a conversion is worth, so
  // conversion history cannot possibly change what it does.
  const clicksCold = applyEdit(broad, {
    kind: 'campaign_bid_strategy', id: 'c-search', bidStrategy: 'maximise_clicks',
  }, 0).state;
  const clicksWarm = structuredClone(clicksCold);
  for (const c of clicksWarm.campaigns) {
    c.runtime.trailingConversions = Array.from({ length: 30 }, () => 6);
    c.runtime.strategyChangedDay = -30;
  }
  check('but a strategy that never asks what a conversion is worth cannot learn from one',
    JSON.stringify(run(clicksCold, 5, { seed: SEED }).results)
      === JSON.stringify(run(clicksWarm, 5, { seed: SEED }).results),
    'maximise clicks is byte-identical cold and trained — it is not optimising toward anything');
}

// ═══════════════════════════════════════════════ 6. Performance Max ═════════

section('Module 7 — Performance Max, and what it quietly takes');
{
  const searchOnly = buildD2CFixedAccount();
  const withPmax = structuredClone(searchOnly);
  withPmax.campaigns.push(campaign({
    id: 'c-pmax', name: 'Performance Max', type: 'pmax',
    dailyBudget: 1800, bidStrategy: 'maximise_conversions', pmaxReach: 1,
  }));

  const before = run(searchOnly, 14, { seed: SEED });
  const after = run(withPmax, 14, { seed: SEED });

  const brandAfter = campaignTotals(after.results, 'c-brand');
  const pmax = campaignTotals(after.results, 'c-pmax');

  check('Performance Max enters brand auctions it was never pointed at',
    pmax.impressions > 0,
    `${pmax.impressions.toLocaleString('en-IN')} impressions, ${pmax.conversions} conversions, ${inr(pmax.cost)}`);

  const brandKw = keywordTotals(after.results, 'f-brand-p');
  const brandKwBefore = keywordTotals(before.results, 'f-brand-p');
  check('and it takes brand traffic off the Search campaign that was already winning it',
    brandKw.impressions < brandKwBefore.impressions * 0.9,
    `the phrase brand keyword's impressions fall ${brandKwBefore.impressions.toLocaleString('en-IN')} `
    + `→ ${brandKw.impressions.toLocaleString('en-IN')}`);

  check('the exact-match brand keyword holds its ground, because it outranks PMax by rule',
    keywordTotals(after.results, 'f-brand-e').impressions
      > keywordTotals(before.results, 'f-brand-e').impressions * 0.9,
    'an exact-match keyword identical to the query takes precedence — the actual fix');

  check('and PMax reports categories rather than the search terms it bought',
    after.results.some((d) => d.pmaxInsights.length > 0)
    && after.results.every((d) => d.searchTerms.every((s) => s.campaignId !== 'c-pmax')),
    'brand cannibalisation is invisible in the one report that would prove it');

  // The fix a learner is meant to find.
  const excluded = structuredClone(withPmax);
  excluded.negatives.push(negative({
    id: 'n-pmax-brand', level: 'campaign', ownerId: 'c-pmax', text: 'northbound', match: 'broad',
  }));
  const ex = run(excluded, 14, { seed: SEED });
  check('a brand exclusion on PMax hands the traffic back',
    campaignTotals(ex.results, 'c-brand').impressions > brandAfter.impressions,
    `brand campaign impressions ${brandAfter.impressions.toLocaleString('en-IN')} `
    + `→ ${campaignTotals(ex.results, 'c-brand').impressions.toLocaleString('en-IN')}`);
}

// ═══════════════════════════════════════ 7. App campaigns (UAC) ════════════

section('App campaigns — the cost per install is the number that lies');
{
  // The inversion the whole module rests on. If this stops being true, every App
  // lesson downstream becomes a lie told confidently.
  const cpi = (c: typeof APP_CHANNELS[number]) => c.cpm / 1000 / (c.ctr * c.installRate);
  const cpe = (c: typeof APP_CHANNELS[number]) =>
    cpi(c) / (NORTHBOUND_APP.eventRate * c.retention);

  const cheapest = [...APP_CHANNELS].sort((a, b) => cpi(a) - cpi(b))[0];
  const dearest = [...APP_CHANNELS].sort((a, b) => cpi(b) - cpi(a))[0];

  check('the cheapest installs come from the worst inventory',
    cpi(cheapest) < cpi(dearest) * 0.2 && cpe(cheapest) > cpe(dearest) * 2,
    `${cheapest.label} sells installs at ${inr(cpi(cheapest))} and customers at ${inr(cpe(cheapest))}; `
    + `${dearest.label} sells installs at ${inr(cpi(dearest))} and customers at ${inr(cpe(dearest))}`);

  check('and the cheap channels cannot produce a customer within the margin',
    cpe(cheapest) > NORTHBOUND_APP.ceiling && cpe(dearest) < NORTHBOUND_APP.ceiling,
    `ceiling ${inr(NORTHBOUND_APP.ceiling)}: ${cheapest.label} needs ${inr(cpe(cheapest))}, `
    + `${dearest.label} needs ${inr(cpe(dearest))}`);
}

{
  const installsRun = run(buildAppStartingAccount(), 28, { seed: SEED }).results;
  const actionRun = run(buildAppFixedAccount(), 28, { seed: SEED }).results;

  const appTotals = (results: GDayResult[]) =>
    results.flatMap((r) => r.apps).reduce((a, x) => ({
      cost: a.cost + x.cost, installs: a.installs + x.installs, events: a.events + x.events,
      value: a.value + x.convValue,
    }), { cost: 0, installs: 0, events: 0, value: 0 });

  const i = appTotals(installsRun);
  const a = appTotals(actionRun);

  check('both campaigns spend the same money',
    Math.abs(a.cost - i.cost) / i.cost < 0.05,
    `${inr(i.cost)} vs ${inr(a.cost)} over 28 days`);

  check('optimising for installs buys far more of them, far cheaper',
    i.installs > a.installs * 2 && i.cost / i.installs < a.cost / a.installs * 0.5,
    `${i.installs.toLocaleString('en-IN')} installs at ${inr(i.cost / i.installs)} versus `
    + `${a.installs.toLocaleString('en-IN')} at ${inr(a.cost / a.installs)}`);

  // The finding the module exists for, stated as bluntly as the model permits.
  check('and produces fewer customers, at a cost the margin cannot cover',
    a.events > i.events * 1.5
    && i.cost / i.events > NORTHBOUND_APP.ceiling
    && a.cost / a.events < NORTHBOUND_APP.ceiling,
    `${i.events} first purchases at ${inr(i.cost / i.events)} against a ${inr(NORTHBOUND_APP.ceiling)} `
    + `ceiling, versus ${a.events} at ${inr(a.cost / a.events)}`);

  check('so the reported metric moves the wrong way while the business improves',
    i.cost / i.installs < a.cost / a.installs && i.value / i.cost < a.value / a.cost,
    `cost per install worsens ${inr(i.cost / i.installs)} → ${inr(a.cost / a.installs)} `
    + `while ROAS improves ${(i.value / i.cost).toFixed(2)} → ${(a.value / a.cost).toFixed(2)}`);

  const activation = (t: { installs: number; events: number }) => t.events / t.installs;
  check('because the installs themselves are different people',
    activation(a) > activation(i) * 3,
    `${pct(activation(i))} of installs make a purchase when buying installs, `
    + `${pct(activation(a))} when buying purchases`);

  check('an install-optimised campaign loses money outright',
    i.value / i.cost < 1 / VERTICALS.d2c.conditions.margin,
    `ROAS ${(i.value / i.cost).toFixed(2)} against break-even `
    + `${(1 / VERTICALS.d2c.conditions.margin).toFixed(2)} — a campaign nobody would question `
    + 'on the numbers it reports');
}

{
  // Assets are not decoration: they are which half of the internet you may run on.
  const noVideo = buildAppFixedAccount();
  noVideo.campaigns[0].app!.assets = { headlines: 8, descriptions: 5, images: 10, videos: 0 };
  const withVideo = buildAppFixedAccount();

  const channelsUsed = (s: GState) => {
    const seen = new Set<string>();
    for (const r of run(s, 7, { seed: SEED }).results) {
      for (const app of r.apps) for (const ch of app.channels) if (ch.impressions > 0) seen.add(ch.channelId);
    }
    return seen;
  };

  check('no video means no YouTube inventory',
    !channelsUsed(noVideo).has('youtube') && channelsUsed(withVideo).has('youtube'),
    'the format gates the placement, and the placement is never selectable');

  const noImages = buildAppFixedAccount();
  noImages.campaigns[0].app!.assets = { headlines: 8, descriptions: 5, images: 0, videos: 4 };
  const withoutImages = channelsUsed(noImages);
  check('and no images means no Display or Discover',
    !withoutImages.has('display') && !withoutImages.has('discover'),
    `runs on ${[...withoutImages].join(', ') || 'nothing'}`);

  const noText = buildAppFixedAccount();
  noText.campaigns[0].app!.assets = { headlines: 0, descriptions: 0, images: 10, videos: 4 };
  const dead = run(noText, 3, { seed: SEED }).results;
  check('and with no text assets the campaign cannot run at all',
    dead.every((d) => d.apps.every((x) => x.impressions === 0 && Boolean(x.blocked))),
    dead[0]?.apps[0]?.blocked ?? 'no result');
}

{
  // A target is a filter, here as everywhere else.
  const impossible = buildAppFixedAccount();
  impossible.campaigns[0].app!.targetEventCpa = 120;
  const results = run(impossible, 5, { seed: SEED }).results;
  check('a target no channel can meet stops the campaign rather than improving it',
    results.every((d) => d.apps.every((x) => x.cost === 0 && Boolean(x.blocked))),
    `asking for a ${inr(120)} customer in a market whose cheapest is `
    + `${inr(Math.min(...APP_CHANNELS.map((c) => c.cpm / 1000 / (c.ctr * c.installRate) / (NORTHBOUND_APP.eventRate * c.retention))))} `
    + 'delivers nothing at all');
}

// ══════════════════════════════════════════════ 7. The market itself ════════

section('The world — sanity of the simulated market');
{
  const { results } = run(buildD2CFixedAccount(), 28, { seed: SEED });
  const t = sum(results);

  check('click-through lands in a believable search band',
    ctr(t) > 0.04 && ctr(t) < 0.2, pct(ctr(t)));
  check('cost per click lands in a believable Indian retail band',
    cpc(t) > 12 && cpc(t) < 120, inr(cpc(t)));
  check('conversion rate lands in a believable D2C band',
    t.conversions / t.clicks > 0.02 && t.conversions / t.clicks < 0.12,
    pct(t.conversions / t.clicks));

  // Weekends are quieter, which is what a weekday-shaped market means.
  //
  // Measured on an account whose budget cannot bind, because a budget-limited one
  // shows the opposite: on a quiet day it never catches its pacing limit, serves a
  // far higher share of the auctions there are, and can end up with *more*
  // impressions than on a busy one. That is real behaviour and worth knowing, but
  // it is not the weekday shape, and testing the two together would measure
  // neither.
  const uncapped = buildD2CFixedAccount();
  for (const c of uncapped.campaigns) c.dailyBudget = 200_000;
  const free = run(uncapped, 28, { seed: SEED }).results;
  const byWeekday = [0, 1, 2, 3, 4, 5, 6].map((w) =>
    avg(free.filter((_, i) => i % 7 === w).map((d) => d.account.impressions)));
  check('search is a weekday business',
    Math.max(byWeekday[0], byWeekday[6]) < avg(byWeekday.slice(1, 6)) * 0.92,
    `weekend ${Math.round(Math.max(byWeekday[0], byWeekday[6])).toLocaleString('en-IN')} impressions/day `
    + `vs weekday ${Math.round(avg(byWeekday.slice(1, 6))).toLocaleString('en-IN')}`);
  check('and a budget-limited account inverts that, because quiet days throttle less',
    (() => {
      const capped = [0, 1, 2, 3, 4, 5, 6].map((w) =>
        avg(results.filter((_, i) => i % 7 === w).map((d) => d.account.impressions)));
      return Math.max(capped[0], capped[6]) > avg(capped.slice(1, 6));
    })(),
    'the same market, read through a budget, tells the opposite story — which is why pacing has to be modelled');

  check('research pages sell fewer ad slots than buying pages',
    GMODEL.slotsByIntent.informational < GMODEL.slotsByIntent.transactional,
    `${GMODEL.slotsByIntent.informational} slots on an informational search, `
    + `${GMODEL.slotsByIntent.transactional} on a transactional one`);
}

{
  // Both verticals have to be internally coherent, or the B2B account teaches
  // arithmetic that is only true for shoes.
  for (const v of [VERTICALS.d2c, VERTICALS.b2b]) {
    const ids = new Set(v.queries.map((q) => q.id));
    check(`${v.brand}: query ids are unique`, ids.size === v.queries.length,
      `${v.queries.length} queries`);
    check(`${v.brand}: every query carries concepts`,
      v.queries.every((q) => q.concepts.length > 0 && q.concepts.every((c) => conceptsOf(c).length > 0)),
      'concepts survive tokenisation');
    check(`${v.brand}: brand queries exist and are a small minority`,
      v.queries.some((q) => q.brand)
      && v.queries.filter((q) => q.brand).reduce((n, q) => n + q.volume, 0) / v.dailySearches < 0.12,
      `${pct(v.queries.filter((q) => q.brand).reduce((n, q) => n + q.volume, 0) / v.dailySearches)} of daily volume`);
    check(`${v.brand}: the long tail converts better than the head`,
      avg(v.queries.filter((q) => q.volume <= 40 && !q.brand).map((q) => q.cvrMultiplier))
        > avg(v.queries.filter((q) => q.volume >= 600 && !q.brand).map((q) => q.cvrMultiplier)) * 2,
      'small specific searches are worth several times a big vague one');
  }

  // The two verticals must genuinely differ, or there is no reason to offer both.
  check('the two verticals are economically different businesses',
    VERTICALS.b2b.conditions.conversionValue / VERTICALS.d2c.conditions.conversionValue > 3
    && VERTICALS.b2b.dailySearches < VERTICALS.d2c.dailySearches,
    `a demo is worth ${inr(VERTICALS.b2b.conditions.conversionValue)} against an order at `
    + `${inr(VERTICALS.d2c.conditions.conversionValue)}, in a market ${(VERTICALS.b2b.dailySearches / VERTICALS.d2c.dailySearches * 100).toFixed(0)}% the size`);
}

// ─────────────────────────────────────────────────────────────── reporting ──

console.log(notes.join('\n'));
if (failures.length > 0) {
  console.error(`\n${failures.length} calibration failure(s):\n`);
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`\n${notes.filter((n) => n.startsWith('  ok')).length} calibration checks passed.`);
