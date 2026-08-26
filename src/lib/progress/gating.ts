import { prisma } from '../db';
import { META_LESSONS, metaLessonBySlug, metaLessonItemId, metaModuleBySlug } from '../content/meta-ads';
import { GOOGLE_LESSONS, googleLessonBySlug, googleModuleBySlug } from '../content/google-ads';
import { FREE_MODULE_COUNT } from '../payments/pricing';
import { entitlementsFor } from '../payments/entitlements';

/**
 * The Learn -> Run gate. A course opts in by adding a checker here; courses with no
 * entry have no Run tier yet and are simply never unlockable. Accepts either the
 * top-level `prisma` client or a `$transaction` callback's `tx`, both expose the
 * same `.attempt.findMany` shape, so the same checker works whether it's called from
 * inside `recordAttempt`'s transaction (the normal path) or as a live fallback read
 * (see `checkAndUnlockRun`).
 */
type Db = Pick<typeof prisma, 'attempt'>;
type LearnCompleteChecker = (db: Db, profileId: string) => Promise<boolean>;

/** Builds a checker from a course's lesson list. Every course's completion test is
 *  the same shape — every lesson passed at least once — so the only per-course part
 *  is which list to check against. */
function allLessonsPassed(courseId: string, itemIds: string[]): LearnCompleteChecker {
  return async (db, profileId) => {
    if (itemIds.length === 0) return false;
    const passed = await db.attempt.findMany({
      where: { profileId, courseId, itemType: 'lesson', passed: true },
      select: { itemId: true },
    });
    const passedIds = new Set(passed.map((a) => a.itemId));
    return itemIds.every((id) => passedIds.has(id));
  };
}

const LEARN_COMPLETE_CHECKERS: Record<string, LearnCompleteChecker> = {
  'meta-ads': allLessonsPassed('meta-ads', META_LESSONS.map(metaLessonItemId)),
  'google-ads': allLessonsPassed('google-ads', GOOGLE_LESSONS.map((l) => `${l.moduleSlug}/${l.slug}`)),
};

/**
 * Which courses have a Run tier at all.
 *
 * Deliberately its own list rather than being derived from the completion
 * checkers, which is how it used to work. Once a second course had a Learn tier
 * and no Run tier, deriving one from the other would have quietly advertised a
 * simulator that does not exist. Finishing Learn and having somewhere to go next
 * are two different facts.
 */
const RUN_TIER_COURSES: ReadonlySet<string> = new Set(['meta-ads', 'google-ads']);

/** True once this course has a Learn tier and this learner has finished every lesson in it. */
export async function isLearnComplete(db: Db, profileId: string, courseId: string): Promise<boolean> {
  const checker = LEARN_COMPLETE_CHECKERS[courseId];
  if (!checker) return false;
  return checker(db, profileId);
}

/** True for any course with a Run tier built. Used to decide whether to show a Run section at all. */
export function hasRunTier(courseId: string): boolean {
  return RUN_TIER_COURSES.has(courseId);
}

/**
 * Reads the cached unlock state, falling back to a live check for enrollments that
 * finished Learn before this gate existed (or before `recordAttempt` last ran), and
 * persisting the result so the fast path (`runUnlockedAt` already set) applies from
 * then on. Safe to call on every Run-page load; the live check only runs on the
 * still-locked path, and only for courses with a Run tier at all.
 *
 * Requires BOTH the progress gate (every Learn lesson passed) and the payment gate
 * (`runPurchasedAt`, set by a verified 'run' or 'bundle' purchase), finishing the
 * lessons doesn't skip paying, and paying doesn't skip finishing the lessons.
 */
export async function isRunUnlocked(profileId: string, courseId: string): Promise<boolean> {
  if (!hasRunTier(courseId)) return false;

  const { hasRun, isDemo } = await entitlementsFor(profileId, courseId);
  // The demo account skips the progress gate as well as the payment one. It exists
  // to inspect what has been built, and requiring 23 lessons before the simulator
  // could be looked at would make it useless for the one job it has. The locked
  // state stays testable the honest way, from an ordinary account.
  if (isDemo) return true;
  if (!hasRun) return false;

  const enrollment = await prisma.enrollment.findUnique({
    where: { profileId_courseId: { profileId, courseId } },
    select: { runUnlockedAt: true },
  });
  if (enrollment?.runUnlockedAt) return true;

  const complete = await isLearnComplete(prisma, profileId, courseId);
  if (complete) {
    await prisma.enrollment.updateMany({
      where: { profileId, courseId, runUnlockedAt: null },
      data: { runUnlockedAt: new Date() },
    });
  }
  return complete;
}

/**
 * How a course resolves an itemId back to a module index and a real lesson.
 *
 * Registered per course rather than switched on inside the gate, so adding a
 * course is a line here and nothing else. A course with no entry has no Learn
 * paywall and is never unlockable, which is the safe default: an unknown course
 * fails closed.
 */
type LessonResolver = (moduleSlug: string, lessonSlug: string) => { moduleIndex: number } | null;

const LESSON_RESOLVERS: Record<string, LessonResolver> = {
  'meta-ads': (moduleSlug, lessonSlug) => {
    const mod = metaModuleBySlug(moduleSlug);
    if (!mod) return null;
    const lesson = metaLessonBySlug(lessonSlug);
    if (!lesson || lesson.moduleSlug !== moduleSlug) return null;
    return { moduleIndex: mod.index };
  },
  'google-ads': (moduleSlug, lessonSlug) => {
    const mod = googleModuleBySlug(moduleSlug);
    if (!mod) return null;
    const lesson = googleLessonBySlug(lessonSlug);
    if (!lesson || lesson.moduleSlug !== moduleSlug) return null;
    return { moduleIndex: mod.index };
  },
};

/**
 * The Learn paywall: modules 1..FREE_MODULE_COUNT are always playable; the rest need
 * a verified 'learn' or 'bundle' purchase (`learnPurchasedAt`). The module is read
 * straight off itemId's `{moduleSlug}/{slug}` shape, so this works from a raw
 * attempt POST body without re-resolving the lesson object.
 *
 * The resolver validates that itemId names a real lesson *in that module*, not just
 * a real module slug — otherwise a fabricated itemId inside a free module records
 * as a novel "first pass" and farms XP.
 */
export async function isLessonUnlocked(
  profileId: string,
  courseId: string,
  itemId: string,
): Promise<boolean> {
  const resolve = LESSON_RESOLVERS[courseId];
  if (!resolve) return false;

  const [moduleSlug, lessonSlug] = itemId.split('/');
  const found = resolve(moduleSlug, lessonSlug);
  if (!found) return false;
  if (found.moduleIndex <= FREE_MODULE_COUNT) return true;

  const { hasLearn } = await entitlementsFor(profileId, courseId);
  return hasLearn;
}

/** Meta Ads' paywall, kept as a named entry point for the callers that predate
 *  multi-course gating. */
export async function isMetaLessonUnlocked(profileId: string, itemId: string): Promise<boolean> {
  return isLessonUnlocked(profileId, 'meta-ads', itemId);
}

/** True when this course has a Learn tier whose lessons can be gated at all. */
export function hasLearnTier(courseId: string): boolean {
  return courseId in LESSON_RESOLVERS;
}
