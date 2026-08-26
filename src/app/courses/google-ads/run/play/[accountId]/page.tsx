import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireProfileId } from '@/lib/auth/server';
import { isRunUnlocked } from '@/lib/progress/gating';
import { createGAccount, loadGAccount, loadGDays, loadGSandbox } from '@/lib/gsim/account';
import { buildSandbox } from '@/lib/gsim/scenarios/sandbox';
import { googleMissionById } from '@/lib/gsim/missions';
import { VERTICALS, type VerticalId } from '@/lib/gsim/verticals';
import { GoogleAccountView } from '@/components/google/GoogleAccountView';
import type { GState } from '@/lib/gsim/engine/types';
import type { GMissionGrade } from '@/lib/gsim/missions/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Run, Google Ads Mastery, Tiramisu' };

/**
 * One simulated account, mission or free play.
 *
 * The literal id `sandbox` resolves to the learner's free-play account, creating
 * it on first visit. Everything else is looked up by id and scoped to the owner,
 * so a guessed id returns a 404 rather than somebody else's account.
 */
export default async function PlayGoogleAccount({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const profileId = await requireProfileId('/courses/google-ads/run');
  if (!(await isRunUnlocked(profileId, 'google-ads'))) redirect('/courses/google-ads/run');

  const { accountId } = await params;

  let account = accountId === 'sandbox'
    ? await loadGSandbox(profileId)
    : await loadGAccount(accountId, profileId);

  if (!account && accountId === 'sandbox') {
    account = await createGAccount({ profileId, state: buildSandbox('d2c') });
  }
  if (!account) notFound();

  const [days, run] = await Promise.all([
    loadGDays(account.id),
    account.missionId
      ? prisma.missionRun.findUnique({
        where: { profileId_missionId: { profileId, missionId: account.missionId } },
      })
      : Promise.resolve(null),
  ]);

  const state = account.state as GState;
  const verticalId: VerticalId =
    state.conditions.conversionName === VERTICALS.b2b.conditions.conversionName ? 'b2b' : 'd2c';
  const vertical = VERTICALS[verticalId];

  const mission = account.missionId ? googleMissionById(account.missionId) : undefined;

  // Only the fields that cross the server boundary. A GMission carries
  // buildState(), which is a function and cannot be serialised into a client
  // component — the mistake that 500s a whole route and shows up nowhere except
  // in a browser.
  const brief = mission
    ? {
      id: mission.id,
      title: mission.title,
      situation: mission.situation,
      brief: mission.brief,
      hints: mission.hints,
      durationDays: mission.durationDays,
      xp: mission.xp,
      objectives: mission.objectives.map((o) => ({ id: o.id, label: o.label, why: o.why })),
    }
    : null;

  const graded = run && run.status !== 'in_progress' && run.objectives
    ? {
      passed: run.status === 'passed',
      score: run.score ?? 0,
      objectives: run.objectives as unknown as GMissionGrade['objectives'],
      met: (run.objectives as unknown as GMissionGrade['objectives']).filter((o) => o.passed).length,
      total: (run.objectives as unknown as GMissionGrade['objectives']).length,
    } satisfies GMissionGrade
    : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 md:px-6">
          <Link
            href="/courses/google-ads/run"
            className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <ArrowLeft size={15} /> {mission ? 'Missions' : 'Run'}
          </Link>
          <span className="text-sm font-bold">{vertical.brand}</span>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <GoogleAccountView
          accountId={account.id}
          initialState={state}
          initialDays={days}
          brand={vertical.brand}
          verticalLabel={vertical.label}
          breakEven={1 / vertical.conditions.margin}
          ceiling={vertical.conditions.conversionValue * vertical.conditions.margin}
          conversionName={vertical.conditions.conversionName}
          mission={brief}
          initialGrade={graded}
        />
      </div>
    </div>
  );
}
