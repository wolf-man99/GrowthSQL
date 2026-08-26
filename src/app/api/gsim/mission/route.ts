import { prisma } from '@/lib/db';
import { createGAccount, loadGAccount, loadGDays } from '@/lib/gsim/account';
import { requireGoogleRunAccess } from '@/lib/gsim/guard';
import { googleMissionById } from '@/lib/gsim/missions';
import { gradeMission } from '@/lib/gsim/missions/grade';
import { recordGoogleMissionGrade, startGoogleMissionRun } from '@/lib/gsim/missions/progress';

export const runtime = 'nodejs';

/**
 * Starting and finishing a mission.
 *
 * `action: 'start'` opens a fresh account from the mission's own starting state.
 * Restarting abandons the previous attempt rather than resuming it: a mission is a
 * scenario with a fixed horizon, and half-played state from an earlier go would
 * make the grade measure a different exercise than the one set.
 *
 * `action: 'grade'` closes it out. The grade is computed server-side from the days
 * the engine recorded, never from anything the client sends, because the client
 * has every reason to want a better score than it earned.
 */
export async function POST(req: Request) {
  const auth = await requireGoogleRunAccess();
  if (!auth.ok) return auth.response;

  let body: { action?: string; missionId?: string; accountId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const mission = googleMissionById(body.missionId ?? '');
  if (!mission) return Response.json({ error: 'Unknown mission.' }, { status: 400 });

  if (body.action === 'start') {
    // Retire anything still open for this mission, so a learner never ends up with
    // two live accounts for the same scenario and no way to tell them apart.
    await prisma.simAccount.updateMany({
      where: {
        profileId: auth.profileId, courseId: 'google-ads',
        missionId: mission.id, status: 'active',
      },
      data: { status: 'abandoned' },
    });

    const account = await createGAccount({
      profileId: auth.profileId,
      missionId: mission.id,
      state: mission.buildState(),
    });
    await startGoogleMissionRun(auth.profileId, mission.id, account.id);
    return Response.json({ ok: true, accountId: account.id });
  }

  if (body.action === 'grade') {
    if (typeof body.accountId !== 'string') {
      return Response.json({ error: 'accountId is required.' }, { status: 400 });
    }
    const account = await loadGAccount(body.accountId, auth.profileId);
    if (!account || account.missionId !== mission.id) {
      return Response.json({ error: 'Account not found.' }, { status: 404 });
    }
    if (account.currentDay < mission.durationDays) {
      return Response.json(
        {
          error: `This mission runs ${mission.durationDays} days. You are on day `
            + `${account.currentDay} — advance the clock to the end before grading.`,
        },
        { status: 409 },
      );
    }

    // Replayed from the persisted days rather than from the request, so the grade
    // reflects what the engine actually produced.
    const results = await loadGDays(account.id);
    const grade = gradeMission({ mission, results, finalState: account.state });
    const { xpAwarded } = await recordGoogleMissionGrade(auth.profileId, mission.id, grade);

    await prisma.simAccount.update({
      where: { id: account.id },
      data: { status: 'complete' },
    });

    return Response.json({ ok: true, grade, xpAwarded, debrief: mission.debrief });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
