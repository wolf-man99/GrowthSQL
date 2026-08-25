import type { CourseLesson, CourseModule, LessonCard } from '../lesson-cards';

/**
 * Meta Ads' slice of the shared card model.
 *
 * The card shapes, the interactivity rule and the prose helpers all live in
 * ../lesson-cards, because they are the same for every paid-media course. What is
 * genuinely Meta's own is the vocabulary of its illustrations and calculators, and
 * that is all this file now declares. Google Ads has its own pair, so a lesson
 * cannot reference the wrong course's diagram by accident: it is a type error.
 */

export type DiagramVariant =
  | 'campaign-structure'
  | 'funnel'
  | 'auction'
  | 'pixel-flow'
  | 'audiences'
  | 'cbo'
  | 'creative-anatomy'
  | 'metrics-flow'
  | 'creative-formats'
  | 'learning-phase'
  | 'testing-matrix'
  | 'fatigue-curve'
  | 'scaling-paths';

export type CalcVariant =
  | 'roas'
  | 'breakeven-roas'
  | 'cpa'
  | 'budget-split'
  | 'learning-budget'
  | 'frequency';

export type MetaCard = LessonCard<DiagramVariant, CalcVariant>;
export type MetaLesson = CourseLesson<DiagramVariant, CalcVariant>;
export type MetaModule = CourseModule<DiagramVariant, CalcVariant>;

export { isInteractive, p, h, list, key } from '../lesson-cards';
