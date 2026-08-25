/**
 * A learner's progress through the mission set.
 *
 * Missions unlock in order, because each one assumes the habits the previous ones
 * built: diagnosing a funnel break (6) is much harder without having learned to
 * read a campaign (1), and scaling (7) is meaningless before the learning phase
 * makes sense (4). Locking is a teaching decision, not a gate for its own sake, so
 * a failed attempt still unlocks the next one, and a learner can always replay.
 */

import { prisma } from '@/lib/db';
import { MISSIONS, missionById } from './index';
import type { Mission, MissionGrade } from './types';

export type MissionStatus = 'locked' | 'available' | 'in_progress' | 'passed' | 'failed';

export interface MissionProgress {
  mission: Mission;
  status: MissionStatus;
  score: number | null;
  /** The account currently running this mission, if one is open. */
  accountId: string | null;
}

/**
 * Every mission with the learner's standing against it.
 *
 * A mission is available once the one before it has been *attempted*, not passed.
 * Requiring a pass would strand someone on a mission they are struggling with,
 * which is exactly when moving on and coming back helps most.
 */
export async function missionProgress(profileId: string): Promise<MissionProgress[]> {
  const [runs, accounts] = await Promise.all([
    prisma.missionRun.findMany({ where: { profileId } }),
    prisma.simAccount.findMany({
      where: { profileId, missionId: { not: null }, status: 'active' },
      select: { id: true, missionId: true },
    }),
  ]);

  const runById = new Map(runs.map((r) => [r.missionId, r]));
  const accountByMission = new Map(accounts.map((a) => [a.missionId as string, a.id]));

  const ordered = [...MISSIONS].sort((a, b) => a.order - b.order);
  let previousAttempted = true; // the first mission is always open

  return ordered.map((mission) => {
    const run = runById.get(mission.id);
    const accountId = accountByMission.get(mission.id) ?? null;

    let status: MissionStatus;
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

/** Marks a mission as started, or returns the run already in flight. */
export async function startMissionRun(profileId: string, missionId: string, accountId: string) {
  return prisma.missionRun.upsert({
    where: { profileId_missionId: { profileId, missionId } },
    // Replaying resets the record rather than creating a second one: the unique
    // key is (profile, mission), and a learner's latest attempt is the one that
    // counts. Their earlier score is not history worth keeping here.
    update: { status: 'in_progress', accountId, score: null, objectives: undefined, gradedAt: null },
    create: { profileId, missionId, accountId, status: 'in_progress' },
  });
}

/**
 * Records a grade, and awards XP the first time a mission is passed.
 *
 * Re-passing a mission awards nothing further. Replaying is encouraged and should
 * cost nothing, but it must not become an XP faucet, which would make the
 * leaderboard a measure of patience rather than skill.
 */
export async function recordMissionGrade(
  profileId: string,
  missionId: string,
  grade: MissionGrade,
): Promise<{ xpAwarded: number }> {
  const mission = missionById(missionId);
  if (!mission) return { xpAwarded: 0 };

  const existing = await prisma.missionRun.findUnique({
    where: { profileId_missionId: { profileId, missionId } },
  });
  const alreadyPassed = existing?.status === 'passed';

  const xpAwarded = grade.passed && !alreadyPassed ? grade.xpAwarded : 0;

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
