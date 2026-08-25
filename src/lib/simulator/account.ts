/**
 * Persistence for the Run simulator: the bridge between the pure engine and Prisma.
 *
 * The engine knows nothing about databases, and deliberately so. This module owns
 * the other half: loading an account's state, running ticks against it, writing the
 * resulting day rows, and reading them back aggregated for the dashboard.
 *
 * Two shapes of data, for two different jobs:
 *   - `SimAccount.state` is a JSON document, because every read of it is "give me
 *     this learner's whole account" and normalising it into five tables would buy
 *     nothing but joins.
 *   - `SimDay` rows are relational, because they are read *across* entities and
 *     date ranges, which is exactly what SQL is for.
 */

import { prisma } from '@/lib/db';
import {
  applyEdit as applyEditPure,
  previewReset,
  tick,
  type DayResult,
  type SimEdit,
  type SimState,
} from './engine';
import { resolveCreative } from './creatives';
import { missionById } from './missions';
import type { ScheduledEvent } from './missions/types';

/** Rollup key used for the account-level row in SimDay. */
export const ACCOUNT_ENTITY = '__account__';

export interface SimAccountRecord {
  id: string;
  profileId: string;
  courseId: string;
  missionId: string | null;
  currentDay: number;
  status: string;
  seed: number;
  state: SimState;
}

function toRecord(row: {
  id: string; profileId: string; courseId: string; missionId: string | null;
  currentDay: number; status: string; seed: number; state: unknown;
}): SimAccountRecord {
  return { ...row, state: row.state as SimState };
}

export async function loadAccount(accountId: string, profileId: string): Promise<SimAccountRecord | null> {
  const row = await prisma.simAccount.findFirst({ where: { id: accountId, profileId } });
  return row ? toRecord(row) : null;
}

/** The learner's current sandbox account for a course, if they have one. */
export async function loadSandbox(profileId: string, courseId: string): Promise<SimAccountRecord | null> {
  const row = await prisma.simAccount.findFirst({
    where: { profileId, courseId, missionId: null, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  return row ? toRecord(row) : null;
}

export async function createAccount(input: {
  profileId: string;
  courseId: string;
  missionId?: string | null;
  state: SimState;
  seed?: number;
}): Promise<SimAccountRecord> {
  const row = await prisma.simAccount.create({
    data: {
      profileId: input.profileId,
      courseId: input.courseId,
      missionId: input.missionId ?? null,
      // A per-account seed, so two learners running the same mission get genuinely
      // different weather while each of their own runs stays reproducible.
      seed: input.seed ?? Math.floor(Math.random() * 2_147_483_647),
      currentDay: input.state.day,
      state: input.state as unknown as object,
    },
  });
  return toRecord(row);
}

// ────────────────────────────────────────────────────────────── advancing ──

export interface AdvanceOutcome {
  account: SimAccountRecord;
  results: DayResult[];
  /** Events that fired during this advance, for the day log. */
  events: ScheduledEvent[];
}

/**
 * Applies a mission event to the account's conditions.
 *
 * Events change the world, never the learner's settings. A broken checkout drops
 * conversion rate across every campaign at once and leaves the ads untouched, which
 * is precisely what makes it diagnosable: the learner has to notice that CTR did
 * not move. Mutating their ad sets instead would just look like sabotage.
 */
function applyEvent(state: SimState, event: ScheduledEvent): void {
  switch (event.kind) {
    case 'landingPageQuality':
      state.conditions.landingPageQuality *= event.factor;
      break;
    case 'marketPressure':
      state.conditions.marketPressure *= event.factor;
      break;
    case 'aov':
      state.conditions.aov = Math.round(state.conditions.aov * event.factor);
      break;
  }
}

/**
 * Runs `days` ticks and persists everything in one transaction.
 *
 * State and day rows have to move together: a crash between them would leave an
 * account whose stored history disagrees with its stored state, and since the
 * engine derives tomorrow from today's cumulative counters, that divergence would
 * compound silently rather than fail loudly.
 */
export async function advanceDays(
  account: SimAccountRecord,
  days: number,
): Promise<AdvanceOutcome> {
  const clamped = Math.max(1, Math.min(30, Math.floor(days)));
  const opts = { seed: account.seed, resolveCreative };

  const mission = account.missionId ? missionById(account.missionId) : undefined;

  let state = account.state;
  const results: DayResult[] = [];
  const fired: ScheduledEvent[] = [];
  for (let i = 0; i < clamped; i++) {
    // A mission stops at its own horizon. Checked before the tick, not after:
    // checking after would let the clock run one day past the brief, and the grade
    // would then measure a slightly different exercise than the one set.
    if (mission && state.day >= mission.durationDays) break;

    // Events fire at the start of the day they are scheduled for, so the day the
    // learner is about to watch is the first one that shows the effect.
    for (const event of mission?.events ?? []) {
      if (event.day === state.day) {
        state = structuredClone(state);
        applyEvent(state, event);
        fired.push(event);
      }
    }
    const step = tick(state, opts);
    state = step.state;
    results.push(step.result);
  }

  const rows = results.flatMap((r) => dayRowsFor(account.id, r));

  const [updated] = await prisma.$transaction([
    prisma.simAccount.update({
      where: { id: account.id },
      data: { currentDay: state.day, state: state as unknown as object },
    }),
    prisma.simDay.createMany({ data: rows, skipDuplicates: true }),
  ]);

  return { account: toRecord(updated), results, events: fired };
}

/**
 * Flattens one day's result into rows at every level.
 *
 * Campaign rows are summed from their ad sets rather than tracked separately: the
 * engine delivers at ad set level, so a campaign is definitionally the sum of its
 * children and storing an independently-computed figure would only create an
 * opportunity for the two to disagree.
 */
function dayRowsFor(accountId: string, r: DayResult) {
  const rows: {
    accountId: string; day: number; entityId: string; entityLevel: string;
    spend: number; impressions: number; linkClicks: number; purchases: number; revenue: number; reach: number;
  }[] = [];

  // Explicitly projected, never spread: the result objects carry presentation
  // fields (cpm, frequency, delivery, the nested ads array) that are derived rather
  // than stored, and handing those to createMany is rejected by Prisma.
  const push = (entityId: string, entityLevel: string, m: {
    spend: number; impressions: number; linkClicks: number; purchases: number; revenue: number; reach: number;
  }) => rows.push({
    accountId, day: r.day, entityId, entityLevel,
    spend: m.spend, impressions: m.impressions, linkClicks: m.linkClicks,
    purchases: m.purchases, revenue: m.revenue, reach: m.reach,
  });

  const byCampaign = new Map<string, { spend: number; impressions: number; linkClicks: number; purchases: number; revenue: number; reach: number }>();

  for (const a of r.adSets) {
    push(a.adSetId, 'adset', a);
    for (const adRow of a.ads) {
      push(adRow.adId, 'ad', { ...adRow, reach: 0 });
    }
    const cur = byCampaign.get(a.campaignId) ?? { spend: 0, impressions: 0, linkClicks: 0, purchases: 0, revenue: 0, reach: 0 };
    cur.spend += a.spend; cur.impressions += a.impressions; cur.linkClicks += a.linkClicks;
    cur.purchases += a.purchases; cur.revenue += a.revenue; cur.reach += a.reach;
    byCampaign.set(a.campaignId, cur);
  }
  for (const [campaignId, m] of byCampaign) push(campaignId, 'campaign', m);
  push(ACCOUNT_ENTITY, 'account', r.account);

  return rows;
}

// ───────────────────────────────────────────────────────────────── editing ──

export interface ApplyEditOutcome {
  account?: SimAccountRecord;
  resetAdSetIds: string[];
  error?: string;
}

/**
 * Applies one edit and persists the new state.
 *
 * Does not advance the clock: on a real account a change takes effect on the next
 * delivery, not retroactively, and keeping the two operations separate is what lets
 * a learner make several changes and then watch their combined effect play out.
 */
export async function applyEditToAccount(
  account: SimAccountRecord,
  edit: SimEdit,
): Promise<ApplyEditOutcome> {
  const outcome = applyEditPure(account.state, edit);
  if (outcome.error) return { resetAdSetIds: [], error: outcome.error };

  const updated = await prisma.simAccount.update({
    where: { id: account.id },
    data: { state: outcome.state as unknown as object },
  });
  return { account: toRecord(updated), resetAdSetIds: outcome.resetAdSetIds };
}

/** Whether an edit would restart any learning phases, for a confirm-first UI. */
export function previewEditReset(account: SimAccountRecord, edit: SimEdit): string[] {
  return previewReset(account.state, edit);
}

// ───────────────────────────────────────────────────────────── aggregation ──

export interface RangeTotals {
  spend: number;
  impressions: number;
  linkClicks: number;
  purchases: number;
  revenue: number;
  reach: number;
}

const ZERO: RangeTotals = { spend: 0, impressions: 0, linkClicks: 0, purchases: 0, revenue: 0, reach: 0 };

/**
 * Totals per entity over a day range, for whichever level the dashboard is showing.
 *
 * Reach is summed rather than deduplicated, matching how the rest of the app already
 * treats range reach (see the note on `estimateReach` in demo-account.ts): the same
 * person reached on two days counts twice. That overstates true unique reach, which
 * is exactly the caveat Ads Manager itself carries on multi-day reach figures.
 */
export async function totalsByEntity(
  accountId: string,
  level: 'campaign' | 'adset' | 'ad' | 'account',
  fromDay: number,
  toDay: number,
): Promise<Map<string, RangeTotals>> {
  const grouped = await prisma.simDay.groupBy({
    by: ['entityId'],
    where: { accountId, entityLevel: level, day: { gte: fromDay, lte: toDay } },
    _sum: {
      spend: true, impressions: true, linkClicks: true, purchases: true, revenue: true, reach: true,
    },
  });

  const out = new Map<string, RangeTotals>();
  for (const g of grouped) {
    out.set(g.entityId, {
      spend: g._sum.spend ?? 0,
      impressions: g._sum.impressions ?? 0,
      linkClicks: g._sum.linkClicks ?? 0,
      purchases: g._sum.purchases ?? 0,
      revenue: g._sum.revenue ?? 0,
      reach: g._sum.reach ?? 0,
    });
  }
  return out;
}

/** The account-level rollup for a range. */
export async function accountTotals(accountId: string, fromDay: number, toDay: number): Promise<RangeTotals> {
  const map = await totalsByEntity(accountId, 'account', fromDay, toDay);
  return map.get(ACCOUNT_ENTITY) ?? { ...ZERO };
}

/** The account's day-by-day series, for charting a trend rather than a total. */
export async function dailySeries(accountId: string, fromDay: number, toDay: number) {
  return prisma.simDay.findMany({
    where: { accountId, entityLevel: 'account', day: { gte: fromDay, lte: toDay } },
    orderBy: { day: 'asc' },
    select: { day: true, spend: true, impressions: true, linkClicks: true, purchases: true, revenue: true, reach: true },
  });
}
