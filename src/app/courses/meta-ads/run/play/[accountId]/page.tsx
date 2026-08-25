import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { requireProfileId } from '@/lib/auth/server';
import { isRunUnlocked } from '@/lib/progress/gating';
import {
  accountTotals, createAccount, loadAccount, loadSandbox, segmentTotals, totalsByEntity,
} from '@/lib/simulator/account';
import { buildSimRows } from '@/lib/simulator/view';
import { buildSandboxAccount } from '@/lib/simulator/scenarios/sandbox';
import { rangeByKey, windowFor } from '@/lib/simulator/ranges';
import { missionById } from '@/lib/simulator/missions';
import { SimDashboard } from '@/components/meta/SimDashboard';
import { MissionPanel } from '@/components/meta/MissionPanel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Run, Meta Ads Mastery, Tiramisu' };

/**
 * One simulated account, mission or sandbox.
 *
 * The literal id `sandbox` resolves to the learner's free-play account, creating
 * it on first visit. Everything else is looked up by id and scoped to the owner,
 * so a guessed id returns a 404 rather than someone else's account.
 */
export default async function PlayAccount({
  params, searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const profileId = await requireProfileId('/courses/meta-ads/run');
  if (!(await isRunUnlocked(profileId, 'meta-ads'))) redirect('/courses/meta-ads/run');

  const { accountId } = await params;

  let account = accountId === 'sandbox'
    ? await loadSandbox(profileId, 'meta-ads')
    : await loadAccount(accountId, profileId);

  if (!account && accountId === 'sandbox') {
    account = await createAccount({ profileId, courseId: 'meta-ads', state: buildSandboxAccount() });
  }
  if (!account) notFound();

  // The sandbox has a stable URL of its own, so a learner can bookmark it without
  // pinning a specific account id that a future reset would invalidate.
  if (accountId === 'sandbox' && account.id !== accountId) {
    // Already resolved; nothing to redirect to. The id in the URL stays `sandbox`.
  }

  const mission = account.missionId ? missionById(account.missionId) : undefined;

  const { range } = await searchParams;
  const option = rangeByKey(range);
  const { fromDay, toDay } = windowFor(account.currentDay, option);

  const [campaignTotals, adSetTotals, adTotals, totals, segments] = await Promise.all([
    totalsByEntity(account.id, 'campaign', fromDay, toDay),
    totalsByEntity(account.id, 'adset', fromDay, toDay),
    totalsByEntity(account.id, 'ad', fromDay, toDay),
    accountTotals(account.id, fromDay, toDay),
    segmentTotals(account.id, fromDay, toDay),
  ]);
  const rows = buildSimRows({ state: account.state, campaignTotals, adSetTotals, adTotals });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link href="/courses/meta-ads/run" className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft size={15} /> {mission ? 'Missions' : 'Run'}
          </Link>
          <span className="chip bg-[var(--green)] text-white"><Sparkles size={11} /> Run unlocked</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        {mission ? (
          <MissionPanel
            mission={mission}
            accountId={account.id}
            currentDay={account.currentDay}
          />
        ) : (
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight">Free play</h1>
            <p className="mt-1 max-w-xl text-[var(--text-muted)]">
              NORTHBOUND is yours to run. Pause things, move budgets, and advance the clock to see
              what your decisions actually did. Nothing moves until you move it.
            </p>
          </div>
        )}

        <SimDashboard
          accountId={account.id}
          brandName="NORTHBOUND"
          brandCategory="D2C Streetwear"
          currentDay={account.currentDay}
          state={account.state}
          rows={rows}
          totals={totals}
          segments={segments}
          rangeKey={option.key}
          rangeLabel={option.label}
          maxDay={mission?.durationDays}
          readOnly={account.status !== 'active'}
        />
      </div>
    </div>
  );
}
