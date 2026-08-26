/**
 * A learner's progress through the Google Ads mission set.
 *
 * Missions unlock in order, because each assumes the habits the previous ones
 * built: diagnosing Performance Max taking brand (6) is nearly impossible without
 * having learned to read impression share (5), and impression share means little
 * before the search terms report has been opened (2). Locking is a teaching
 * decision rather than a gate for its own sake, so a *failed* attempt still
 * unlocks the next one — moving on and coming back is exactly what helps when
 * somebody is stuck.
 */

import { prisma } from '@/lib/db';
import { GOOGLE_MISSIONS, googleMissionById } from './index';
import type { GMission, GMissionGrade } from './types';

export type GMissionStatus = 'locked' | 'available' | 'in_progress' | 'passed' | 'failed';

export interface GMissionProgress {
  mission: GMission;
  status: GMissionStatus;
  score: number | null;
  /** The account currently running this mission, if one is open. */
  accountId: string | null;
}

export async function googleMissionProgress(profileId: string): Promise<GMissionProgress[]> {
  const missionIds = GOOGLE_MISSIONS.map((m) => m.id);

  const [runs, accounts] = await Promise.all([
    prisma.missionRun.findMany({ where: { profileId, missionId: { in: missionIds } } }),
    prisma.simAccount.findMany({
      where: { profileId, courseId: 'google-ads', missionId: { in: missionIds }, status: 'active' },
      select: { id: true, missionId: true },
    }),
  ]);

  const runById = new Map(runs.map((r) => [r.missionId, r]));
  const accountByMission = new Map(accounts.map((a) => [a.missionId as string, a.id]));

  const ordered = [...GOOGLE_MISSIONS].sort((a, b) => a.order - b.order);
  let previousAttempted = true; // the first mission is always open

  return ordered.map((mission) => {
    const run = runById.get(mission.id);
    const accountId = accountByMission.get(mission.id) ?? null;

    let status: GMissionStatus;
    if (!previousAttempted && !run) {
      status = 'locked';
    } else if (run?.status === 'passed') {
      status = 'passed';
    } else if (run?.status === 'failed') {
      status = 'failed';
    } else if (run?.status === 'in_progress' || accountId) {
      status = 'in_progress';
    } else {
      status = 'available';
    }

    previousAttempted = Boolean(run);
    return { mission, status, score: run?.score ?? null, accountId };
  });
}

/** Marks a mission as started, or resets the run already recorded for it. */
export async function startGoogleMissionRun(profileId: string, missionId: string, accountId: string) {
  return prisma.missionRun.upsert({
    where: { profileId_missionId: { profileId, missionId } },
    // Replaying resets the record rather than creating a second one. The unique key
    // is (profile, mission), and a learner's latest attempt is the one that counts.
    update: { status: 'in_progress', accountId, score: null, objectives: undefined, gradedAt: null },
    create: { profileId, missionId, accountId, status: 'in_progress' },
  });
}

/**
 * Records a grade, and awards XP the first time a mission is passed.
 *
 * Re-passing awards nothing further. Replaying should cost nothing and is worth
 * encouraging, but it must not become an XP faucet — that would make the
 * leaderboard a measure of patience rather than of skill.
 */
export async function recordGoogleMissionGrade(
  profileId: string,
  missionId: string,
  grade: GMissionGrade,
): Promise<{ xpAwarded: number }> {
  const mission = googleMissionById(missionId);
  if (!mission) return { xpAwarded: 0 };

  const existing = await prisma.missionRun.findUnique({
    where: { profileId_missionId: { profileId, missionId } },
  });
  const alreadyPassed = existing?.status === 'passed';
  const xpAwarded = grade.passed && !alreadyPassed ? mission.xp : 0;

  await prisma.$transaction([
    prisma.missionRun.upsert({
      where: { profileId_missionId: { profileId, missionId } },
      update: {
        status: grade.passed ? 'passed' : 'failed',
        score: grade.score,
        objectives: grade.objectives as unknown as object,
        gradedAt: new Date(),
      },
      create: {
        profileId, missionId,
        status: grade.passed ? 'passed' : 'failed',
        score: grade.score,
        objectives: grade.objectives as unknown as object,
        gradedAt: new Date(),
      },
    }),
    ...(xpAwarded > 0
      ? [prisma.profile.update({ where: { id: profileId }, data: { xp: { increment: xpAwarded } } })]
      : []),
  ]);

  return { xpAwarded };
}
