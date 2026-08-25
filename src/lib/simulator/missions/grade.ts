/**
 * Grading a mission run.
 *
 * Every objective resolves to a number the engine actually recorded, compared
 * against a threshold the mission declared up front. Nothing here interprets
 * intent or rewards effort: a learner should be able to look at the account and
 * work out their own grade before the screen tells them, which is only true if the
 * measures are ones they can see.
 *
 * Pure, so the calibration script can play a mission programmatically and assert
 * that a correct strategy passes and a plausible wrong one fails. A mission nobody
 * has verified is beatable is not a mission, it is a guess.
 */

import type { DayResult, SimState } from '../engine';
import type { Comparator, MetricKey, Mission, MissionGrade, Objective, ObjectiveResult } from './types';

export interface GradeInput {
  mission: Mission;
  /** Every day the account actually ran, oldest first. */
  results: DayResult[];
  /** The account as it stands at the end. */
  finalState: SimState;
}

function compare(actual: number, op: Comparator, target: number): boolean {
  return op === 'gte' ? actual >= target : actual <= target;
}

const sum = (rs: DayResult[], f: (r: DayResult) => number) => rs.reduce((a, r) => a + f(r), 0);

/**
 * Resolves one metric over a set of days plus the final state.
 *
 * Rate metrics (ROAS, CPA, CTR) are computed from summed totals rather than
 * averaged across days: averaging daily ROAS would weight a ₹200 day the same as a
 * ₹20,000 one and quietly reward a learner for having a good quiet day.
 */
function measure(metric: MetricKey, days: DayResult[], finalState: SimState): number {
  const spend = sum(days, (r) => r.account.spend);
  const revenue = sum(days, (r) => r.account.revenue);
  const purchases = sum(days, (r) => r.account.purchases);

  switch (metric) {
    case 'roas': return spend > 0 ? revenue / spend : 0;
    case 'cpa': return purchases > 0 ? spend / purchases : Number.POSITIVE_INFINITY;
    case 'spend': return spend;
    case 'dailySpend': return days.length > 0 ? spend / days.length : 0;
    case 'purchases': return purchases;
    case 'revenue': return revenue;
    case 'accountCtr': {
      const impressions = sum(days, (r) => r.account.impressions);
      return impressions > 0 ? (sum(days, (r) => r.account.linkClicks) / impressions) * 100 : 0;
    }
    // Delivery states are a property of where the account ended up, not of the days
    // it ran, so these read the final state and ignore the window entirely.
    case 'adSetsLimited':
      return finalState.adSets.filter((a) => a.status === 'active' && a.runtime.learningState === 'limited').length;
    case 'adSetsActive':
      return finalState.adSets.filter((a) => a.status === 'active' && a.runtime.learningState === 'active').length;
  }
}

function evaluate(objective: Objective, input: GradeInput): ObjectiveResult {
  const { results, finalState } = input;
  const span = objective.window && objective.window > 0 ? objective.window : 1;

  const base: Omit<ObjectiveResult, 'passed' | 'actual'> = {
    id: objective.id,
    label: objective.label,
    target: objective.value,
    op: objective.op,
    metric: objective.metric,
  };

  if (objective.when === 'everyDay') {
    // Every window in the run has to hold, not just the last one. Reported `actual`
    // is the worst of them, because that is the stretch that failed it and the one
    // worth going back to look at.
    //
    // Windows are rolling and measured on summed totals, so a single noisy day
    // cannot fail an objective on its own unless `window` is 1. That is deliberate:
    // "never let ROAS collapse" should catch a bad week, not a bad Tuesday.
    let worst = objective.op === 'gte' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    let passed = results.length > 0;
    for (let end = span; end <= results.length; end++) {
      const value = measure(objective.metric, results.slice(end - span, end), finalState);
      worst = objective.op === 'gte' ? Math.min(worst, value) : Math.max(worst, value);
      if (!compare(value, objective.op, objective.value)) passed = false;
    }
    return { ...base, passed, actual: Number.isFinite(worst) ? worst : 0 };
  }

  const scoped = objective.window && objective.window > 0 ? results.slice(-span) : results;
  const actual = measure(objective.metric, scoped, finalState);
  return { ...base, passed: compare(actual, objective.op, objective.value), actual };
}

/**
 * Grades a completed run.
 *
 * Passing requires every objective, not a majority: the missions each carry two or
 * three, and they are chosen so that hitting one while missing another usually
 * means the learner optimised the wrong thing. Scaling spend while letting ROAS
 * collapse is the classic version, and calling that a partial pass would teach
 * exactly the wrong instinct.
 *
 * The score is still proportional, so a near-miss reads differently from a rout.
 */
export function gradeMission(input: GradeInput): MissionGrade {
  const objectives = input.mission.objectives.map((o) => evaluate(o, input));
  const met = objectives.filter((o) => o.passed).length;
  const passed = objectives.length > 0 && met === objectives.length;
  return {
    passed,
    score: objectives.length > 0 ? Math.round((met / objectives.length) * 100) : 0,
    objectives,
    xpAwarded: passed ? input.mission.xp : Math.round(input.mission.xp * 0.25),
  };
}

/** Human wording for an objective's threshold, used in the brief and the debrief. */
export function describeTarget(o: Objective): string {
  const dir = o.op === 'gte' ? 'at least' : 'no more than';
  switch (o.metric) {
    case 'roas': return `${dir} ${o.value.toFixed(2)}x ROAS`;
    case 'cpa': return `${dir} ₹${o.value.toLocaleString('en-IN')} per purchase`;
    case 'spend': return `${dir} ₹${o.value.toLocaleString('en-IN')} spent`;
    case 'dailySpend': return `${dir} ₹${o.value.toLocaleString('en-IN')} a day`;
    case 'purchases': return `${dir} ${o.value} purchases`;
    case 'revenue': return `${dir} ₹${o.value.toLocaleString('en-IN')} revenue`;
    case 'accountCtr': return `${dir} ${o.value}% CTR`;
    case 'adSetsLimited': return `${dir} ${o.value} ad set${o.value === 1 ? '' : 's'} in Learning Limited`;
    case 'adSetsActive': return `${dir} ${o.value} ad set${o.value === 1 ? '' : 's'} out of the learning phase`;
  }
}

/** Formats a measured value the same way its target is worded. */
export function formatActual(r: ObjectiveResult): string {
  switch (r.metric) {
    case 'roas': return `${r.actual.toFixed(2)}x`;
    case 'cpa': return Number.isFinite(r.actual) ? `₹${Math.round(r.actual).toLocaleString('en-IN')}` : 'no purchases';
    case 'spend':
    case 'dailySpend':
    case 'revenue': return `₹${Math.round(r.actual).toLocaleString('en-IN')}`;
    case 'accountCtr': return `${r.actual.toFixed(2)}%`;
    default: return String(Math.round(r.actual));
  }
}
