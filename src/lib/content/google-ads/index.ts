import type { GoogleModule, GoogleLesson } from './types';
import { G1_LESSONS } from './modules/m1-foundations';
import { G2_LESSONS } from './modules/m2-keywords';
import { G3_LESSONS } from './modules/m3-ads';
import { G4_LESSONS } from './modules/m4-quality-score';
import { G5_LESSONS } from './modules/m5-bidding';
import { G6_LESSONS } from './modules/m6-shopping-pmax';
import { G7_LESSONS } from './modules/m7-optimising';

/**
 * The Google Ads course: seven modules, beginner through intermediate.
 *
 * Scoped to the same band as Meta Ads — levels 1 to 7 of 10 — so the two sit
 * together as a coherent paid-media pair rather than one running deeper than the
 * other. Portfolio bidding, scripts, incrementality testing and the API are
 * deliberately absent; they belong to an advanced course with different
 * prerequisites, and half-covering them here would be worse than omitting them.
 *
 * Module order follows dependency rather than the interface's own menu. Quality
 * Score gets a module of its own because it is the concept that separates a buyer
 * who can improve an account from one who can only raise bids, and it has to land
 * before bidding strategy makes any sense.
 */
export const GOOGLE_MODULES: GoogleModule[] = [
  { slug: 'foundations', index: 1, title: 'Foundations', tagline: 'Intent, structure, the auction & the metrics', emoji: '🔍', status: 'available', lessons: G1_LESSONS },
  { slug: 'keywords', index: 2, title: 'Keywords & intent', tagline: 'Match types, search terms, and saying no', emoji: '🎯', status: 'available', lessons: G2_LESSONS },
  { slug: 'ads', index: 3, title: 'Ads & assets', tagline: 'Responsive search ads and the page behind the click', emoji: '✍️', status: 'available', lessons: G3_LESSONS },
  { slug: 'quality-score', index: 4, title: 'Quality Score', tagline: 'The multiplier that decides what everything costs', emoji: '⭐', status: 'available', lessons: G4_LESSONS },
  { slug: 'bidding', index: 5, title: 'Bidding & budgets', tagline: 'Conversion signal, Smart Bidding, impression share', emoji: '💰', status: 'available', lessons: G5_LESSONS },
  { slug: 'shopping', index: 6, title: 'Shopping & Performance Max', tagline: 'Feeds, asset groups, and what PMax hides', emoji: '🛒', status: 'available', lessons: G6_LESSONS },
  { slug: 'optimising', index: 7, title: 'Optimising & scaling', tagline: 'The weekly loop, and four directions to grow', emoji: '📈', status: 'available', lessons: G7_LESSONS },
];

export const GOOGLE_LESSONS: GoogleLesson[] = GOOGLE_MODULES.flatMap((m) => m.lessons);

export function googleModuleBySlug(slug: string): GoogleModule | undefined {
  return GOOGLE_MODULES.find((m) => m.slug === slug);
}

export function googleLessonBySlug(slug: string): GoogleLesson | undefined {
  return GOOGLE_LESSONS.find((l) => l.slug === slug);
}

/** The item id used to record a lesson completion (course-scoped). */
export function googleLessonItemId(lesson: GoogleLesson): string {
  return `${lesson.moduleSlug}/${lesson.slug}`;
}

/** Ordered lesson slugs, for "next lesson" navigation. */
export const GOOGLE_LESSON_ORDER: string[] = GOOGLE_LESSONS.map((l) => l.slug);

export function nextGoogleLesson(slug: string): GoogleLesson | undefined {
  const i = GOOGLE_LESSON_ORDER.indexOf(slug);
  return i >= 0 && i + 1 < GOOGLE_LESSONS.length ? GOOGLE_LESSONS[i + 1] : undefined;
}

export const GOOGLE_TOTAL_XP = GOOGLE_LESSONS.reduce((a, l) => a + l.xp, 0);
export const GOOGLE_AVAILABLE_LESSONS = GOOGLE_LESSONS.length;
