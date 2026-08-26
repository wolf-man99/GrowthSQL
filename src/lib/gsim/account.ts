/**
 * Persistence for the Google Ads simulator: the bridge between the pure engine
 * and Prisma.
 *
 * The engine knows nothing about databases and deliberately so. This module owns
 * the other half — loading an account, running ticks, writing the days, and
 * reading them back for the dashboard.
 *
 * Days are stored whole rather than shredded into rows, which is the one decision
 * here worth explaining. Meta's simulator writes relational rows because its
 * reports slice *across* entities and date ranges. Google's do not: a search terms
 * report, an impression-share breakdown and a Performance Max category view are
 * all "this one account, these ninety days", which is a handful of rows however
 * they are stored. Splitting a day into five tables would buy joins nobody needs
 * and five chances for the pieces to disagree about what happened.
 */

import { prisma } from '@/lib/db';
import {
  applyEdit as applyEditPure,
  type GEdit,
} from './state';
import { tick, type GDayResult, type GState } from './engine';

export interface GAccountRecord {
  id: string;
  profileId: string;
  courseId: string;
  missionId: string | null;
  currentDay: number;
  status: string;
  seed: number;
  state: GState;
}

function toRecord(row: {
  id: string; profileId: string; courseId: string; missionId: string | null;
  currentDay: number; status: string; seed: number; state: unknown;
}): GAccountRecord {
  return { ...row, state: row.state as GState };
}

export async function loadGAccount(accountId: string, profileId: string): Promise<GAccountRecord | null> {
  const row = await prisma.simAccount.findFirst({
    where: { id: accountId, profileId, courseId: 'google-ads' },
  });
  return row ? toRecord(row) : null;
}

/** The learner's current free-play account, if they have one. */
export async function loadGSandbox(profileId: string): Promise<GAccountRecord | null> {
  const row = await prisma.simAccount.findFirst({
    where: { profileId, courseId: 'google-ads', missionId: null, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  return row ? toRecord(row) : null;
}

export async function createGAccount(input: {
  profileId: string;
  missionId?: string | null;
  state: GState;
  seed?: number;
}): Promise<GAccountRecord> {
  const row = await prisma.simAccount.create({
    data: {
      profileId: input.profileId,
      courseId: 'google-ads',
      missionId: input.missionId ?? null,
      // A per-account seed, so two learners running the same scenario get genuinely
      // different weather while each of their own runs stays reproducible.
      seed: input.seed ?? Math.floor(Math.random() * 2_147_483_647),
      currentDay: input.state.day,
      state: input.state as unknown as object,
    },
  });
  return toRecord(row);
}

// ─────────────────────────────────────────────────────────────── advancing ──

export interface GAdvanceOutcome {
  account: GAccountRecord;
  results: GDayResult[];
}

/** Days a single request may advance. The engine simulates every search in a day
 *  individually, so an unbounded request is a way to hold a connection open. */
export const MAX_ADVANCE_DAYS = 14;

/**
 * Runs `days` ticks and persists everything in one transaction.
 *
 * State and day rows have to move together: a crash between them would leave an
 * account whose stored history disagrees with its stored state, and because the
 * engine derives tomorrow from today's cumulative counters — a keyword's CTR
 * history, a campaign's trailing conversions — that divergence would compound
 * silently rather than fail loudly.
 */
export async function advanceGDays(
  account: GAccountRecord,
  days: number,
  horizon?: number,
): Promise<GAdvanceOutcome> {
  const clamped = Math.max(1, Math.min(MAX_ADVANCE_DAYS, Math.floor(days)));

  let state = account.state;
  const results: GDayResult[] = [];
  for (let i = 0; i < clamped; i++) {
    // A mission stops at its own horizon. Checked before the tick and not after:
    // checking after would let the clock run a day past the brief, and the grade
    // would then measure a slightly different exercise than the one that was set.
    if (horizon !== undefined && state.day >= horizon) break;
    const step = tick(state, { seed: account.seed });
    state = step.state;
    results.push(step.result);
  }

  const [updated] = await prisma.$transaction([
    prisma.simAccount.update({
      where: { id: account.id },
      data: { currentDay: state.day, state: state as unknown as object },
    }),
    prisma.gSimDay.createMany({
      data: results.map((r) => ({
        accountId: account.id,
        day: r.day,
        result: r as unknown as object,
      })),
      skipDuplicates: true,
    }),
  ]);

  return { account: toRecord(updated), results };
}

// ──────────────────────────────────────────────────────────────── reading ──

/**
 * Every day this account has lived, oldest first.
 *
 * Read whole rather than paged. An account's whole life is at most a few months of
 * days, and the dashboard's date picker needs to re-aggregate across an arbitrary
 * window of them anyway — so fetching a window from the database and then
 * discovering the learner wanted a different one is two round trips to save
 * nothing.
 */
export async function loadGDays(accountId: string): Promise<GDayResult[]> {
  const rows = await prisma.gSimDay.findMany({
    where: { accountId },
    orderBy: { day: 'asc' },
    select: { result: true },
  });
  return rows.map((r) => r.result as unknown as GDayResult);
}

// ────────────────────────────────────────────────────────────────── edits ──

/**
 * Applies one edit and saves it.
 *
 * Every change a learner makes goes through here, which is what lets the engine
 * charge for the ones that cost something: changing a bid strategy or moving a
 * target restarts a learning period, and `applyEdit` is where that gets recorded.
 * Applying edits directly to the stored state would make that lesson unenforceable.
 */
export async function applyGEdit(
  account: GAccountRecord,
  edit: GEdit,
): Promise<{ account: GAccountRecord; resetLearning: boolean; note: string }> {
  const outcome = applyEditPure(account.state, edit, account.currentDay);
  const row = await prisma.simAccount.update({
    where: { id: account.id },
    data: { state: outcome.state as unknown as object },
  });
  return { account: toRecord(row), resetLearning: outcome.resetLearning, note: outcome.note };
}
