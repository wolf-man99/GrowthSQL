/**
 * Date ranges for the simulator, in simulated days.
 *
 * Lives in a plain module rather than beside the dashboard component because both
 * sides need it: the server page resolves `?range=` into a day window before it
 * queries, and the client renders the picker. Exporting it from a `'use client'`
 * file would hand the server a client-reference proxy instead of the array, which
 * fails at request time rather than at build time.
 *
 * Ranges count simulated days, not calendar dates. This account has its own clock,
 * and borrowing the wall calendar would misdescribe what actually happened.
 */

export interface RangeOption {
  key: string;
  label: string;
  /** 0 means "everything since the account opened". */
  days: number;
}

export const RANGE_OPTIONS: RangeOption[] = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '14', label: 'Last 14 days', days: 14 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: 'all', label: 'All time', days: 0 },
];

export const DEFAULT_RANGE = RANGE_OPTIONS[2];

export function rangeByKey(key: string | undefined): RangeOption {
  return RANGE_OPTIONS.find((r) => r.key === key) ?? DEFAULT_RANGE;
}

/**
 * Turns a range into the inclusive day window to aggregate over.
 *
 * `currentDay` is the day about to run, so the last day with any recorded delivery
 * is the one before it. A brand-new account clamps to an empty window rather than
 * a negative one.
 */
export function windowFor(currentDay: number, range: RangeOption): { fromDay: number; toDay: number } {
  const toDay = Math.max(0, currentDay - 1);
  const fromDay = range.days === 0 ? 0 : Math.max(0, toDay - (range.days - 1));
  return { fromDay, toDay };
}
