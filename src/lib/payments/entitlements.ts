/**
 * What a learner is entitled to, in one place.
 *
 * Before this, six call sites each read `Enrollment.learnPurchasedAt` and
 * `runPurchasedAt` for themselves — two gates, two page loads, and the checkout
 * route. That was fine while a purchase was the only way to be entitled. It stops
 * being fine the moment there is a second way, because "add the new case" then
 * means finding all six and getting all six right.
 *
 * The second way is the demo account. It exists so the whole platform can be
 * walked end to end without paying for anything or grinding through a curriculum
 * to reach the tier behind it, and — the part that matters as courses keep
 * landing — it is entitled to courses that do not exist yet. A demo profile is
 * entitled to everything by virtue of being one, so a new course needs no demo
 * setup at all.
 */

import { prisma } from '@/lib/db';

export interface Entitlements {
  /** Can open every Learn module, not just the free preview. */
  hasLearn: boolean;
  /** Has paid for the Run tier. Still needs the progress gate on top; see
   *  `isRunUnlocked`, which is where the two halves are combined. */
  hasRun: boolean;
  /** Entitled by being the demo account rather than by paying. Callers that offer
   *  something for sale check this: the demo account must never reach a real
   *  Razorpay order, and telling it that it already owns everything is both true
   *  and the simplest way to keep it out of checkout. */
  isDemo: boolean;
}

const NOTHING: Entitlements = { hasLearn: false, hasRun: false, isDemo: false };

/**
 * One query, because both facts live on rows keyed by the same profile and every
 * caller wants them together.
 *
 * A missing enrollment is not an error: a learner who has opened a course but
 * never bought anything simply has no row yet, and that is indistinguishable from
 * owning nothing, which is what they own.
 */
export async function entitlementsFor(profileId: string, courseId: string): Promise<Entitlements> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      isDemo: true,
      enrollments: {
        where: { courseId },
        select: { learnPurchasedAt: true, runPurchasedAt: true },
        take: 1,
      },
    },
  });
  if (!profile) return { ...NOTHING };

  // Deliberately not "demo OR purchased" per field: the demo account is entitled
  // to the whole platform, including courses that ship after it was created.
  if (profile.isDemo) return { hasLearn: true, hasRun: true, isDemo: true };

  const enrollment = profile.enrollments[0];
  return {
    hasLearn: Boolean(enrollment?.learnPurchasedAt),
    hasRun: Boolean(enrollment?.runPurchasedAt),
    isDemo: false,
  };
}

/** Whether this profile is the demo account, when the courseId is not to hand. */
export async function isDemoProfile(profileId: string): Promise<boolean> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { isDemo: true },
  });
  return Boolean(profile?.isDemo);
}
