import Link from 'next/link';
import { ArrowLeft, Lock, PartyPopper, Sparkles, Zap } from 'lucide-react';
import { META_LESSONS } from '@/lib/content/meta-ads';
import { prisma } from '@/lib/db';
import { requireProfileId } from '@/lib/auth/server';
import { isRunUnlocked, isLearnComplete } from '@/lib/progress/gating';
import { META_ADS_PRICING } from '@/lib/payments/pricing';
import { Card, Button, Progress } from '@/components/ui/primitives';
import { CheckoutButton } from '@/components/payments/CheckoutButton';
import { SimDashboard } from '@/components/meta/SimDashboard';
import { rangeByKey, windowFor } from '@/lib/simulator/ranges';
import { accountTotals, createAccount, loadSandbox, totalsByEntity } from '@/lib/simulator/account';
import { buildSimRows } from '@/lib/simulator/view';
import { buildSandboxAccount } from '@/lib/simulator/scenarios/sandbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Run, Meta Ads Mastery, Tiramisu' };

export default async function MetaAdsRun({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const profileId = await requireProfileId('/courses/meta-ads/run');

  const unlocked = await isRunUnlocked(profileId, 'meta-ads');

  if (!unlocked) {
    // Parallel is safe: DATABASE_URL carries pgbouncer=true, so Prisma's engine never
    // relies on server-side prepared statements. See the fuller note in
    // courses/meta-ads/page.tsx.
    const [profile, done, learnComplete] = await Promise.all([
      prisma.profile.findUniqueOrThrow({ where: { id: profileId } }),
      prisma.attempt.findMany({
        where: { profileId, courseId: 'meta-ads', itemType: 'lesson', passed: true },
        select: { itemId: true },
      }),
      isLearnComplete(prisma, profileId, 'meta-ads'),
    ]);
    return <LockedState completedCount={done.length} xp={profile.xp} level={profile.level} learnComplete={learnComplete} />;
  }

  // The learner's live account, created on first visit and reopened on every one
  // after. Opening Run must never silently start a fresh account and discard the
  // decisions already made in it.
  let account = await loadSandbox(profileId, 'meta-ads');
  if (!account) {
    account = await createAccount({ profileId, courseId: 'meta-ads', state: buildSandboxAccount() });
  }

  const { range } = await searchParams;
  const option = rangeByKey(range);
  const { fromDay, toDay } = windowFor(account.currentDay, option);

  const [campaignTotals, adSetTotals, adTotals, totals] = await Promise.all([
    totalsByEntity(account.id, 'campaign', fromDay, toDay),
    totalsByEntity(account.id, 'adset', fromDay, toDay),
    totalsByEntity(account.id, 'ad', fromDay, toDay),
    accountTotals(account.id, fromDay, toDay),
  ]);

  const rows = buildSimRows({ state: account.state, campaignTotals, adSetTotals, adTotals });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5 md:px-8">
          <Link href="/courses/meta-ads" className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft size={15} /> Meta Ads Mastery
          </Link>
          <span className="chip bg-[var(--green)] text-white"><Sparkles size={11} /> Run unlocked</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-[var(--ink)] bg-[var(--green)] text-white shadow-[3px_3px_0_var(--ink)]">
            <PartyPopper size={22} />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Your account</h1>
            <p className="mt-1 max-w-xl text-[var(--text-muted)]">
              NORTHBOUND is yours to run. Pause things, move budgets, and advance the clock
              to see what your decisions actually did. Nothing moves until you move it.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <SimDashboard
            accountId={account.id}
            brandName="NORTHBOUND"
            brandCategory="D2C Streetwear"
            currentDay={account.currentDay}
            state={account.state}
            rows={rows}
            totals={totals}
            rangeKey={option.key}
            rangeLabel={option.label}
          />
        </div>
      </div>
    </div>
  );
}

function LockedState({ completedCount, xp, level, learnComplete }: { completedCount: number; xp: number; level: number; learnComplete: boolean }) {
  const total = META_LESSONS.length;
  const pct = total ? completedCount / total : 0;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5 md:px-8">
          <Link href="/courses/meta-ads" className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft size={15} /> Meta Ads Mastery
          </Link>
          <span className="flex items-center gap-1.5 rounded-full border-2 border-[var(--ink)] bg-[var(--blue)] px-3 py-1 text-[13px] font-bold text-white">
            <Zap size={13} /> {xp} XP · Lvl {level}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-5 py-16 text-center md:px-8">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface-3)] shadow-[3px_3px_0_var(--ink)]">
          <Lock size={26} className="text-[var(--text-muted)]" />
        </span>
        {learnComplete ? (
          <>
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight">You finished Learn. Run is ₹{META_ADS_PRICING.run} to unlock</h1>
            <p className="mt-2 text-[var(--text-muted)]">
              The theory&apos;s solid. Pay to step into the account simulator, or grab the bundle if
              you&apos;re about to start another course.
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              <CheckoutButton product="run" label={`Buy Run - ₹${META_ADS_PRICING.run}`} size="lg" />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Run is locked</h1>
            <p className="mt-2 text-[var(--text-muted)]">
              Finish every lesson in Learn to unlock the account simulator. This is where the
              decisions get real, so the theory needs to be solid first.
            </p>

            <Card className="mt-6 p-4 text-left">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-bold">Learn progress</span>
                <span className="font-bold tabular-nums text-[var(--text-muted)]">{completedCount} / {total} lessons</span>
              </div>
              <Progress value={pct} color="var(--blue)" />
            </Card>
          </>
        )}

        <Link href="/courses/meta-ads" className="mt-6 inline-block">
          <Button size="lg" variant={learnComplete ? 'secondary' : 'primary'}>Back to Learn</Button>
        </Link>
      </div>
    </div>
  );
}
