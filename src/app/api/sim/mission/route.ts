import { prisma } from '@/lib/db';
import { createAccount, loadAccount } from '@/lib/simulator/account';
import { requireRunAccess } from '@/lib/simulator/guard';
import { missionById, gradeMission } from '@/lib/simulator/missions';
import { recordMissionGrade, startMissionRun } from '@/lib/simulator/missions/progress';

export const runtime = 'nodejs';

/**
 * Starting and finishing a mission.
 *
 * `action: 'start'` opens a fresh account from the mission's own starting state.
 * Restarting deliberately abandons the previous attempt rather than resuming it:
 * a mission is a scenario with a fixed horizon, and half-played state from an
 * earlier go would make the grade meaningless.
 *
 * `action: 'grade'` closes it out. The grade is computed server-side from the
 * recorded days, never from anything the client sends, because the client has
 * every reason to want a better score than it earned.
 */
export async function POST(req: Request) {
  const auth = await requireRunAccess();
  if (!auth.ok) return auth.response;

  let body: { action?: string; missionId?: string; accountId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const mission = missionById(body.missionId ?? '');
  if (!mission) return Response.json({ error: 'Unknown mission.' }, { status: 400 });

  if (body.action === 'start') {
    // Retire anything still open for this mission, so a learner never ends up with
    // two live accounts for the same scenario and no way to tell them apart.
    await prisma.simAccount.updateMany({
      where: { profileId: auth.profileId, missionId: mission.id, status: 'active' },
      data: { status: 'abandoned' },
    });

    const account = await createAccount({
      profileId: auth.profileId,
      courseId: 'meta-ads',
      missionId: mission.id,
      state: mission.buildState(),
    });
    await startMissionRun(auth.profileId, mission.id, account.id);
    return Response.json({ ok: true, accountId: account.id });
  }

  if (body.action === 'grade') {
    if (typeof body.accountId !== 'string') {
      return Response.json({ error: 'accountId is required.' }, { status: 400 });
    }
    const account = await loadAccount(body.accountId, auth.profileId);
    if (!account || account.missionId !== mission.id) {
      return Response.json({ error: 'Account not found.' }, { status: 404 });
    }
    if (account.currentDay < mission.durationDays) {
      return Response.json(
        { error: `This mission runs ${mission.durationDays} days. You are on day ${account.currentDay}.` },
        { status: 409 },
      );
    }

    // Replayed from the persisted day rows rather than from anything in the
    // request, so the grade reflects what the engine actually produced.
    const days = await prisma.simDay.findMany({
      where: { accountId: account.id, entityLevel: 'account' },
      orderBy: { day: 'asc' },
    });
    const results = days.map((d) => ({
      day: d.day,
      adSets: [],
      account: {
        spend: d.spend, impressions: d.impressions, linkClicks: d.linkClicks,
        purchases: d.purchases, revenue: d.revenue, reach: d.reach,
      },
    }));

    const grade = gradeMission({ mission, results, finalState: account.state });
    const { xpAwarded } = await recordMissionGrade(auth.profileId, mission.id, grade);
    await prisma.simAccount.update({ where: { id: account.id }, data: { status: 'complete' } });

    return Response.json({ ok: true, grade: { ...grade, xpAwarded } });
  }

  return Response.json({ error: 'action must be start or grade.' }, { status: 400 });
}
