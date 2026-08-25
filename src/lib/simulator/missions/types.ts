/**
 * Missions: the graded scenarios that turn the simulator into a course.
 *
 * A sandbox teaches by letting someone poke at an account. A mission teaches by
 * putting them in a specific situation with a specific goal and then telling them,
 * honestly, whether they got there and why. There is one per Learn module, so
 * everything the theory claims gets practised in the place it applies.
 *
 * Three design rules run through all of them:
 *
 *   1. The starting account is broken in a way the module's lesson fixes. Not
 *      broken generically: a learner who applies the wrong lesson should fail.
 *   2. Objectives are measured, never judged. "Get every ad set out of Learning
 *      Limited" is a number the engine can check; "structure the account well" is
 *      not, and would make the grade feel arbitrary.
 *   3. The debrief explains the mechanism, not just the verdict. Passing without
 *      understanding why is a worse outcome than failing and being told.
 */

import type { SimState } from '../engine/types';

/** Metrics an objective can be measured against, all derived from recorded days. */
export type MetricKey =
  | 'roas'
  | 'cpa'
  | 'spend'
  | 'dailySpend'
  | 'purchases'
  | 'revenue'
  | 'adSetsLimited'
  | 'adSetsActive'
  | 'accountCtr';

export type Comparator = 'gte' | 'lte';

export interface Objective {
  id: string;
  /** Shown to the learner, in the curriculum's own language. */
  label: string;
  metric: MetricKey;
  op: Comparator;
  value: number;
  /**
   * Where the measurement sits. `end` reads the final state, or the totals over the
   * last `window` days; `everyDay` requires the condition to hold across the whole
   * run, which is how "without ever letting ROAS fall below break-even" is said.
   */
  when: 'end' | 'everyDay';
  /**
   * How many days one measurement covers. `when` decides which of them count:
   * `end` takes the final window, `everyDay` takes every window in the run.
   *
   * On an `everyDay` objective this is the difference between a rule about the
   * account and a rule about luck. Daily ROAS on a real account swings ±15% on
   * noise alone, so a single-day floor fails whoever draws the worst Tuesday
   * rather than whoever scaled worst. A three-day window keeps the objective
   * measuring what its label says: a sustained slide, not one bad day.
   */
  window?: number;
}

/**
 * Something the world does to the learner, on a schedule they cannot see coming.
 *
 * Events mutate account conditions rather than entity settings, so they arrive as
 * a change in the numbers rather than as an edit to the account. That is the point:
 * module 6.2's whole lesson is that a downstream break presents as an ads problem,
 * and it only teaches that if the learner has to diagnose it.
 */
export interface ScheduledEvent {
  day: number;
  kind: 'landingPageQuality' | 'marketPressure' | 'aov';
  /** Multiplier applied to the condition. 0.45 halves conversion rate, roughly. */
  factor: number;
  /** Shown in the day log after it fires, worded as a symptom, never as a cause. */
  headline: string;
  /** Revealed in the debrief, where naming the cause is the teaching. */
  cause: string;
}

export interface Mission {
  id: string;
  /** The Learn module this practises, so the UI can link back to the theory. */
  moduleSlug: string;
  order: number;
  title: string;
  /** One line: the situation. */
  situation: string;
  /** What they are being asked to do about it. */
  brief: string;
  /** Concrete nudges toward the right diagnosis, without giving the answer. */
  hints: string[];
  durationDays: number;
  xp: number;
  buildState: () => SimState;
  objectives: Objective[];
  events: ScheduledEvent[];
  /**
   * Written before anyone plays it: what the mission is actually teaching, shown in
   * the debrief regardless of pass or fail. A learner who scraped a pass by luck
   * still needs to read this.
   */
  debrief: string;
}

export interface ObjectiveResult {
  id: string;
  label: string;
  passed: boolean;
  /** The measured value, for "you reached 2.1x, needed 2.5x". */
  actual: number;
  target: number;
  op: Comparator;
  metric: MetricKey;
}

export interface MissionGrade {
  passed: boolean;
  /** Share of objectives met, 0-100. */
  score: number;
  objectives: ObjectiveResult[];
  xpAwarded: number;
}
