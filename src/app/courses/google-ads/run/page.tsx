import Link from 'next/link';
import { ArrowLeft, Lock, Sparkles } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireProfileId } from '@/lib/auth/server';
import { isRunUnlocked, isLearnComplete } from '@/lib/progress/gating';
import { GOOGLE_LESSONS } from '@/lib/content/google-ads';
import { COURSE_PRICING } from '@/lib/payments/pricing';
import { Card, Button, Progress } from '@/components/ui/primitives';
import { CheckoutButton } from '@/components/payments/CheckoutButton';
import { GoogleRunDashboard } from '@/components/google/GoogleRunDashboard';
import { GoogleRunStart } from '@/components/google/GoogleRunStart';
import { loadGSandbox, loadGDays } from '@/lib/gsim/account';
import { VERTICALS, type VerticalId } from '@/lib/gsim/verticals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Run, Google Ads Mastery, Tiramisu' };

export default async function GoogleAdsRun() {
  const profileId = await requireProfileId('/courses/google-ads/run');
  const unlocked = await isRunUnlocked(profileId, 'google-ads');

  if (!unlocked) {
    // Parallel is safe: DATABASE_URL carries pgbouncer=true, so Prisma's engine
    // never relies on server-side prepared statements.
    const [profile, done, learnComplete] = await Promise.all([
      prisma.profile.findUniqueOrThrow({ where: { id: profileId } }),
      prisma.attempt.findMany({
        where: { profileId, courseId: 'google-ads', itemType: 'lesson', passed: true },
        select: { itemId: true },
      }),
      isLearnComplete(prisma, profileId, 'google-ads'),
    ]);
    return <LockedState completed={done.length} xp={profile.xp} learnComplete={learnComplete} />;
  }

  const sandbox = await loadGSandbox(profileId);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-[1400px] px-4 py-7 md:px-6">
        {sandbox ? <Live accountId={sandbox.id} /> : (
          <div className="mx-auto max-w-3xl">
            <Intro />
            <GoogleRunStart resumable={false} />
          </div>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 glass">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 md:px-6">
        <Link
          href="/courses/google-ads"
          className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={15} /> Google Ads Mastery
        </Link>
        <span className="chip bg-[var(--green)] text-white">
          <Sparkles size={11} /> Run unlocked
        </span>
      </div>
    </header>
  );
}

function Intro() {
  return (
    <div className="mb-7">
      <h1 className="text-3xl font-extrabold tracking-tight">Run</h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-[var(--text-muted)]">
        A Google Ads account that answers back. Every search in the market is simulated
        individually — your keywords enter the auctions they match, pay what Ad Rank says
        they owe, and the search terms report shows what you actually bought rather than
        what you asked for.
      </p>
    </div>
  );
}

/**
 * The live account.
 *
 * Days are loaded whole rather than paged. An account's entire life is at most a
 * few months of rows and the dashboard's own date picker re-aggregates across an
 * arbitrary window of them, so fetching a slice server-side would only mean
 * fetching again the moment the learner changed the range.
 */
async function Live({ accountId }: { accountId: string }) {
  const [account, days] = await Promise.all([
    prisma.simAccount.findUniqueOrThrow({ where: { id: accountId } }),
    loadGDays(accountId),
  ]);

  const state = account.state as unknown as import('@/lib/gsim/engine/types').GState;
  // Which market this is, recovered from the account rather than stored twice: the
  // conversion name is set by the vertical and nothing else writes it.
  const verticalId: VerticalId =
    state.conditions.conversionName === VERTICALS.b2b.conditions.conversionName ? 'b2b' : 'd2c';
  const vertical = VERTICALS[verticalId];

  return (
    <GoogleRunDashboard
      accountId={accountId}
      initialState={state}
      initialDays={days}
      brand={vertical.brand}
      verticalLabel={vertical.label}
      breakEven={1 / vertical.conditions.margin}
      ceiling={vertical.conditions.conversionValue * vertical.conditions.margin}
      conversionName={vertical.conditions.conversionName}
    />
  );
}

function LockedState({
  completed, xp, learnComplete,
}: {
  completed: number;
  xp: number;
  learnComplete: boolean;
}) {
  const total = GOOGLE_LESSONS.length;
  const pricing = COURSE_PRICING['google-ads'];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5 md:px-8">
          <Link
            href="/courses/google-ads"
            className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <ArrowLeft size={15} /> Google Ads Mastery
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-10 md:px-8">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-[var(--ink)] bg-[var(--card)] shadow-[3px_3px_0_var(--ink)]">
            <Lock size={20} />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Run is locked</h1>
            <p className="mt-1 text-[var(--text-muted)]">
              Two things unlock it: finish every Learn lesson, and buy the Run tier.
            </p>
          </div>
        </div>

        <Card className="mt-7 p-5">
          <div className="flex items-center justify-between text-sm font-bold">
            <span>Learn progress</span>
            <span>{completed} / {total} lessons</span>
          </div>
          <Progress value={total ? completed / total : 0} className="mt-2" />
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {learnComplete
              ? 'Every lesson passed. One step left.'
              : `${total - completed} lessons to go. ${xp} XP so far.`}
          </p>
          {!learnComplete ? (
            <Link href="/courses/google-ads" className="mt-4 inline-block">
              <Button>Back to lessons</Button>
            </Link>
          ) : null}
        </Card>

        <Card className="mt-4 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Run tier</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                A live account across Search, Performance Max and App campaigns, in two
                different businesses.
              </p>
            </div>
            <span className="shrink-0 text-2xl font-extrabold">₹{pricing.prices.run}</span>
          </div>
          <div className="mt-4">
            <CheckoutButton courseId="google-ads" product="run" label={`Unlock Run — ₹${pricing.prices.run}`} />
          </div>
        </Card>
      </div>
    </div>
  );
}
