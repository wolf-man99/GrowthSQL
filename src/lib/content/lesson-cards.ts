import type { Block } from './types';

/**
 * The card model every paid-media course is built from.
 *
 * The SQL course grades queries, so a lesson there can be checked mechanically.
 * An ads course teaches judgement, which cannot, so a lesson here is a sequence of
 * stepped cards: teaching interleaved with checks the learner has to answer to
 * advance. That model was written for Meta Ads and its own type file said from the
 * start that it would power Google and the rest. This is that promise collected
 * into one place, before the second course made a copy of it.
 *
 * Generic over the two things that genuinely differ per course: the diagrams and
 * the calculators. Meta's illustrations are ad sets and CBO; Google's are Ad Rank
 * and match types, and neither course should be able to reference the other's by
 * accident. Every other card shape is identical across courses, and duplicating it
 * would mean fixing the same bug twice.
 */

export type CardKind =
  | 'teach' | 'tip' | 'diagram' | 'mcq' | 'multi' | 'truefalse' | 'scenario' | 'sort' | 'calc';

export type LessonCard<Diagram extends string, Calc extends string> =
  | { kind: 'teach'; id: string; title?: string; art?: Diagram; blocks: Block[] }
  | { kind: 'tip'; id: string; title: string; text: string }
  | { kind: 'diagram'; id: string; variant: Diagram; title: string; caption: string }
  | { kind: 'mcq'; id: string; prompt: string; options: string[]; answer: number; explain: string }
  | { kind: 'multi'; id: string; prompt: string; options: string[]; answers: number[]; explain: string }
  | { kind: 'truefalse'; id: string; statement: string; isTrue: boolean; explain: string }
  | { kind: 'scenario'; id: string; situation: string; options: { label: string; correct: boolean; feedback: string }[] }
  /** `items` is authored in the correct order; the player shuffles for display. */
  | { kind: 'sort'; id: string; prompt: string; items: string[]; explain: string }
  | { kind: 'calc'; id: string; variant: Calc; title: string; blurb: string };

export interface CourseLesson<Diagram extends string, Calc extends string> {
  slug: string;
  moduleSlug: string;
  title: string;
  subtitle: string;
  minutes: number;
  xp: number;
  objective: string;
  cards: LessonCard<Diagram, Calc>[];
}

export interface CourseModule<Diagram extends string, Calc extends string> {
  slug: string;
  index: number;
  title: string;
  tagline: string;
  emoji: string;
  status: 'available' | 'coming-soon';
  lessons: CourseLesson<Diagram, Calc>[];
}

const INTERACTIVE: ReadonlySet<string> = new Set(['mcq', 'multi', 'truefalse', 'scenario', 'sort']);

/** True when a card requires an answer before the learner may continue. */
export function isInteractive(card: { kind: string }): boolean {
  return INTERACTIVE.has(card.kind);
}

/* ─── Prose helpers, so authoring a lesson reads like writing one ─────────── */

export const p = (text: string): Block => ({ kind: 'p', text });
export const h = (text: string): Block => ({ kind: 'h', text });
export const list = (items: string[], ordered = false): Block => ({ kind: 'list', ordered, items });
export const key = (text: string): Block => ({ kind: 'keyidea', text });
