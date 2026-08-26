/**
 * Grading a mission run.
 *
 * Every objective resolves to a number the engine actually recorded, compared
 * against a threshold the mission declared up front. Nothing here interprets
 * intent or rewards effort: a learner should be able to look at their own reports
 * and work out their grade before the screen tells them, which is only true if
 * every measure is one the interface already shows them.
 *
 * Pure, so the calibration script can play a mission programmatically and assert
 * both halves of what makes it a mission: that a correct strategy passes, and that
 * a plausible wrong one does not. An unplayed mission is a guess, not an exercise.
 */

import type { GDayResult, GState } from '../engine/types';
import type {
  GComparator, GMetricKey, GMission, GMissionGrade, GObjective, GObjectiveResult,
} from './types';

export interface GGradeInput {
  mission: GMission;
  /** Every day the account actually ran, oldest first. */
  results: GDayResult[];
  /** The account as it stands at the end. */
  finalState: GState;
}

function compare(actual: number, op: GComparator, target: number): boolean {
  return op === 'gte' ? actual >= target : actual <= target;
}

const sum = (rs: GDayResult[], f: (r: GDayResult) => number) => rs.reduce((a, r) => a + f(r), 0);

/**
 * Resolves one metric over a set of days plus the final state.
 *
 * Rate metrics are computed from summed totals rather than averaged across days.
 * Averaging daily return on ad spend would weight a ₹200 day the same as a ₹20,000
 * one, and quietly reward a learner for having had a good quiet Sunday.
 */
function measure(metric: GMetricKey, days: GDayResult[], finalState: GState): number {
  const cost = sum(days, (r) => r.account.cost);
  const conversions = sum(days, (r) => r.account.conversions);
  const convValue = sum(days, (r) => r.account.convValue);
  const clicks = sum(days, (r) => r.account.clicks);
  const impressions = sum(days, (r) => r.account.impressions);

  switch (metric) {
    case 'roas': return cost > 0 ? convValue / cost : 0;
    case 'cpa': return conversions > 0 ? cost / conversions : Number.POSITIVE_INFINITY;
    case 'cost': return cost;
    case 'conversions': return conversions;
    case 'ctr': return impressions > 0 ? clicks / impressions : 0;
    case 'cpc': return clicks > 0 ? cost / clicks : 0;

    case 'lostToBudgetShare':
    case 'lostToRankShare': {
      let lost = 0;
      let eligible = 0;
      for (const d of days) {
        for (const k of d.keywords) {
          eligible += k.eligible;
          lost += metric === 'lostToBudgetShare' ? k.lostToBudget : k.lostToRank;
        }
      }
      return eligible > 0 ? lost / eligible : 0;
    }

    case 'avgQualityScore': {
      // Weighted by auctions entered rather than averaged flat, so a keyword that
      // entered forty thousand auctions counts for more than one that entered ten.
      let weighted = 0;
      let weight = 0;
      for (const d of days) {
        for (const k of d.keywords) {
          if (k.qualityScore <= 0 || k.eligible <= 0) continue;
          weighted += k.qualityScore * k.eligible;
          weight += k.eligible;
        }
      }
      return weight > 0 ? weighted / weight : 0;
    }

    case 'brandImpressionShare': {
      // Only the keywords aimed at brand queries, identified by the queries they
      // actually matched rather than by anything in their name — a learner may
      // rename or restructure, and the measurement has to survive that.
      const brandQueryIds = new Set(
        finalState.queries.filter((q) => q.brand).map((q) => q.id),
      );
      const brandKeywordIds = new Set<string>();
      for (const d of days) {
        for (const t of d.searchTerms) {
          if (brandQueryIds.has(t.queryId)) brandKeywordIds.add(t.keywordId);
        }
      }
      let won = 0;
      let eligible = 0;
      for (const d of days) {
        for (const k of d.keywords) {
          if (!brandKeywordIds.has(k.keywordId)) continue;
          won += k.impressions;
          eligible += k.eligible;
        }
      }
      return eligible > 0 ? won / eligible : 0;
    }

    // A property of where the account ended up rather than of the days it ran.
    case 'negativeCount':
      return finalState.negatives.length;

    case 'nonBrandConversions': {
      const brandQueryIds = new Set(finalState.queries.filter((q) => q.brand).map((q) => q.id));
      let n = 0;
      for (const d of days) {
        for (const t of d.searchTerms) {
          if (!brandQueryIds.has(t.queryId)) n += t.conversions;
        }
        // Performance Max and App campaigns do not report search terms, so their
        // conversions are counted here wholesale rather than not at all. Neither
        // is a way to buy brand traffic on purpose, which is what this measures.
        for (const p of d.pmaxInsights) if (p.category !== 'Brand') n += p.conversions;
        for (const a of d.apps) n += a.events;
      }
      return n;
    }

    case 'appActivation': {
      const installs = sum(days, (r) => r.apps.reduce((n, a) => n + a.installs, 0));
      const events = sum(days, (r) => r.apps.reduce((n, a) => n + a.events, 0));
      return installs > 0 ? events / installs : 0;
    }

    case 'appCostPerEvent': {
      const appCost = sum(days, (r) => r.apps.reduce((n, a) => n + a.cost, 0));
      const events = sum(days, (r) => r.apps.reduce((n, a) => n + a.events, 0));
      return events > 0 ? appCost / events : Number.POSITIVE_INFINITY;
    }
  }
}

function evaluate(objective: GObjective, input: GGradeInput): GObjectiveResult {
  const { results, finalState } = input;
  const span = objective.window && objective.window > 0 ? objective.window : 1;

  const base: Omit<GObjectiveResult, 'passed' | 'actual'> = {
    id: objective.id,
    label: objective.label,
    target: objective.value,
    op: objective.op,
    metric: objective.metric,
    why: objective.why,
  };

  if (objective.when === 'everyDay') {
    // Every window in the run has to hold, not only the last. Reported `actual` is
    // the worst of them, because that is the stretch that failed it and the one
    // worth going back to look at.
    //
    // The first few days are skipped: an account that has not yet accumulated a
    // conversion has a return of zero through arithmetic rather than through
    // anything the learner did, and failing them for it would be failing them for
    // the calendar.
    const warmup = Math.min(span + 1, results.length);
    let worst = objective.op === 'gte' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    let held = true;

    for (let i = warmup; i + span <= results.length; i++) {
      const value = measure(objective.metric, results.slice(i, i + span), finalState);
      worst = objective.op === 'gte' ? Math.min(worst, value) : Math.max(worst, value);
      if (!compare(value, objective.op, objective.value)) held = false;
    }

    if (!Number.isFinite(worst)) {
      worst = measure(objective.metric, results, finalState);
      held = compare(worst, objective.op, objective.value);
    }
    return { ...base, passed: held, actual: worst };
  }

  const window = span >= results.length ? results : results.slice(-span);
  const actual = measure(objective.metric, window, finalState);
  return { ...base, passed: compare(actual, objective.op, objective.value), actual };
}

/**
 * Grades a run.
 *
 * A mission passes when every objective does. Deliberately not a threshold — three
 * out of four is not "mostly right" when the fourth was "and do not lose money
 * doing it", and a partial pass would teach that constraints are optional.
 */
export function gradeMission(input: GGradeInput): GMissionGrade {
  const objectives = input.mission.objectives.map((o) => evaluate(o, input));
  const met = objectives.filter((o) => o.passed).length;
  return {
    objectives,
    met,
    total: objectives.length,
    passed: met === objectives.length && objectives.length > 0,
    score: objectives.length > 0 ? Math.round((met / objectives.length) * 100) : 0,
  };
}
