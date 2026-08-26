import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Check, Clock, Lock, PartyPopper, Play, Sparkles, Zap,
} from 'lucide-react';
import {
  GOOGLE_MODULES, GOOGLE_LESSONS, GOOGLE_AVAILABLE_LESSONS, GOOGLE_TOTAL_XP,
} from '@/lib/content/google-ads';
import { prisma } from '@/lib/db';
import { requireProfileId } from '@/lib/auth/server';
import { ensureEnrollment } from '@/lib/progress/persist';
import { entitlementsFor } from '@/lib/payments/entitlements';
import { isRunUnlocked } from '@/lib/progress/gating';
import { FREE_MODULE_COUNT, priceOf } from '@/lib/payments/pricing';
import { Card, Progress } from '@/components/ui/primitives';
import { CourseLogo } from '@/components/app/CourseLogo';
import { CheckoutButton } from '@/components/payments/CheckoutButton';
import { cn } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Google Ads - Tiramisu' };

const LEARN_PRICE = priceOf('google-ads', 'learn') ?? 0;
const RUN_PRICE = priceOf('google-ads', 'run') ?? 0;
const BUNDLE_PRICE = priceOf('google-ads', 'bundle') ?? 0;
const BUNDLE_SAVING = LEARN_PRICE + RUN_PRICE - BUNDLE_PRICE;

/**
 * The Google Ads course home.
 *
 * Structurally a sibling of the Meta Ads page rather than a copy of it: same
 * module list, same progress bar, same free-preview gate, same two-tier shape now
 * that Search has a Run tier of its own.
 *
 * Its pricing block is written here rather than reusing PricingSection, which is
 * hardcoded to the Meta table. Generalising that component is the right change
 * eventually; doing it two days before a launch to serve one extra course is not,
 * and a wrong price on a live checkout is a worse outcome than a duplicated card.
 */
export default async function GoogleAdsHome() {
  const profileId = await requireProfileId('/courses/google-ads');
  await ensureEnrollment(profileId, 'google-ads');

  // Parallel is safe: DATABASE_URL carries pgbouncer=true, so Prisma never relies
  // on server-side prepared statements. See the fuller note in the Meta Ads page.
  const [profile, done, entitlements, runUnlocked] = await Promise.all([
    prisma.profile.findUniqueOrThrow({ where: { id: profileId } }),
    prisma.attempt.findMany({
      where: { profileId, courseId: 'google-ads', itemType: 'lesson', passed: true },
      select: { itemId: true },
    }),
    entitlementsFor(profileId, 'google-ads'),
    isRunUnlocked(profileId, 'google-ads'),
  ]);

  const { hasLearn, hasRun } = entitlements;
  const completed = new Set(done.map((d) => d.itemId));
  const isDone = (moduleSlug: string, slug: string) => completed.has(`${moduleSlug}/${slug}`);
  const completedCount = GOOGLE_LESSONS.filter((l) => isDone(l.moduleSlug, l.slug)).length;
  const learnComplete = GOOGLE_AVAILABLE_LESSONS > 0 && completedCount === GOOGLE_AVAILABLE_LESSONS;

  const isModuleLocked = (moduleIndex: number) => moduleIndex > FREE_MODULE_COUNT && !hasLearn;

  const nextLesson = GOOGLE_LESSONS.find((l) => !isDone(l.moduleSlug, l.slug));
  const nextLessonModule = nextLesson && GOOGLE_MODULES.find((m) => m.slug === nextLesson.moduleSlug);
  const nextLessonLocked = nextLessonModule ? isModuleLocked(nextLessonModule.index) : false;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5 md:px-8">
          <Link href="/courses" className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft size={15} /> Platform
          </Link>
          <span className="flex items-center gap-1.5 rounded-full border-2 border-[var(--ink)] bg-[var(--green)] px-3 py-1 text-[13px] font-bold text-white">
            <Zap size={13} /> {profile.xp} XP · Lvl {profile.level}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        {/* Hero */}
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-[var(--ink)] shadow-[3px_3px_0_var(--green)]"
              style={{ background: 'color-mix(in srgb, var(--green) 18%, white)' }}
            >
              <CourseLogo courseId="google-ads" emoji="🔍" size={64} />
            </span>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Google Ads</h1>
              <p className="mt-0.5 text-[var(--text-muted)]">Capture the demand that already exists.</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-subtle)]">
                <span className="chip" style={{ background: 'var(--amber)' }}><Sparkles size={11} /> Full course · 7 modules</span>
                <span className="flex items-center gap-1 font-semibold"><Clock size={12} /> {GOOGLE_AVAILABLE_LESSONS} lessons live</span>
                <span className="flex items-center gap-1 font-semibold"><Zap size={12} /> {GOOGLE_TOTAL_XP} XP available</span>
              </div>
            </div>
          </div>
          {nextLesson && (
            <Link href={nextLessonLocked ? '#pricing' : `/courses/google-ads/${nextLesson.slug}`}>
              <span className="inline-flex items-center gap-2 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--ink)] px-5 py-3 font-bold text-white shadow-[3px_3px_0_var(--green)] transition-all hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                {nextLessonLocked ? <Lock size={16} /> : <Play size={16} />}
                {nextLessonLocked ? 'Unlock to continue' : completedCount === 0 ? 'Start course' : 'Continue'}
              </span>
            </Link>
          )}
        </div>

        {/* Progress */}
        <Card className="mt-6 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold">Learn progress</span>
            <span className="font-bold tabular-nums text-[var(--text-muted)]">
              {completedCount} / {GOOGLE_AVAILABLE_LESSONS} lessons
            </span>
          </div>
          <Progress value={GOOGLE_AVAILABLE_LESSONS ? completedCount / GOOGLE_AVAILABLE_LESSONS : 0} color="var(--green)" />
        </Card>

        {/* Modules */}
        <div className="mt-8 mb-3 flex items-center gap-2">
          <span className="chip bg-[var(--ink)] text-white">Learn</span>
          <span className="text-xs text-[var(--text-faint)]">
            Search, Shopping and Performance Max, beginner through intermediate.
          </span>
        </div>
        <div className="space-y-4">
          {GOOGLE_MODULES.map((m) => {
            const moduleLocked = isModuleLocked(m.index);
            return (
              <div key={m.slug}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-lg">{m.emoji}</span>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide">Module {m.index}: {m.title}</h2>
                  {moduleLocked && (
                    <Link href="#pricing" className="chip bg-[var(--amber)] text-[var(--ink)]">
                      <Lock size={10} /> ₹{LEARN_PRICE} to unlock
                    </Link>
                  )}
                  <span className="text-xs text-[var(--text-faint)]">{m.tagline}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {m.lessons.map((l) => {
                    const complete = isDone(l.moduleSlug, l.slug);
                    return (
                      <Link key={l.slug} href={moduleLocked ? '#pricing' : `/courses/google-ads/${l.slug}`}>
                        <Card hover className={cn('flex items-center gap-3 p-3.5', moduleLocked && 'opacity-70')}>
                          <span className={cn(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-[var(--ink)] text-xs font-bold',
                            complete ? 'bg-[var(--green)] text-white'
                              : moduleLocked ? 'bg-[var(--surface-3)] text-[var(--text-muted)]'
                                : 'bg-white text-[var(--ink)]',
                          )}>
                            {complete ? <Check size={16} /> : moduleLocked ? <Lock size={13} /> : <Play size={13} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold">{l.title}</div>
                            <div className="truncate text-xs text-[var(--text-subtle)]">{l.subtitle}</div>
                          </div>
                          <span className="flex items-center gap-1 text-xs text-[var(--text-faint)]"><Zap size={11} /> {l.xp}</span>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pricing. Two shapes, because the decision differs: somebody who owns
            nothing is choosing between Learn and the bundle, and somebody who
            already owns Learn is deciding whether to add Run. Showing all three to
            both would make each of them read the wrong question. */}
        {!hasLearn && (
          <div id="pricing" className="mt-10 scroll-mt-20">
            <div className="text-center">
              <span className="chip bg-[var(--green)] text-white">Unlock the full course</span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
                Modules 1–{FREE_MODULE_COUNT} are free. After that, pick one.
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[var(--text-muted)]">
                One payment either way. No subscription, no expiry.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card className="flex flex-col p-5">
                <div className="text-[15px] font-extrabold">Learn</div>
                <div className="mt-0.5 font-display text-[32px] font-extrabold leading-none tracking-tight">
                  ₹{LEARN_PRICE}
                </div>
                <ul className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
                  <li className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
                    All {GOOGLE_AVAILABLE_LESSONS} lessons, {GOOGLE_TOTAL_XP} XP
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
                    Every diagram and calculator
                  </li>
                  <li className="flex items-start gap-2 text-[var(--text-faint)]">
                    <Lock size={13} className="mt-0.5 shrink-0" />
                    The account simulator is not included
                  </li>
                </ul>
                <div className="mt-auto pt-5">
                  <CheckoutButton
                    product="learn"
                    courseId="google-ads"
                    label={`Buy Learn — ₹${LEARN_PRICE}`}
                    variant="secondary"
                    className="w-full justify-center"
                  />
                </div>
              </Card>

              <Card
                className="relative flex flex-col border-[var(--blue)] p-5"
                style={{ boxShadow: '4px 4px 0 var(--blue)' }}
              >
                <span className="absolute -top-3 left-5 whitespace-nowrap rounded-full border-2 border-[var(--ink)] bg-[var(--blue)] px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-white shadow-[2px_2px_0_var(--ink)]">
                  Best value
                </span>
                <div className="text-[15px] font-extrabold">Bundle</div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-display text-[32px] font-extrabold leading-none tracking-tight">
                    ₹{BUNDLE_PRICE}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-faint)] line-through">
                    ₹{LEARN_PRICE + RUN_PRICE}
                  </span>
                </div>
                <span className="mt-2 w-fit rounded-full border-2 border-[var(--ink)] bg-[var(--green)] px-2.5 py-0.5 text-[10.5px] font-extrabold tracking-wide text-white">
                  You save ₹{BUNDLE_SAVING}
                </span>
                <ul className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
                  <li className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
                    Everything in Learn
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
                    The Search account simulator, with seven graded missions
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
                    Search, Performance Max and App campaigns
                  </li>
                </ul>
                <div className="mt-auto pt-5">
                  <CheckoutButton
                    product="bundle"
                    courseId="google-ads"
                    label={`Get the bundle — ₹${BUNDLE_PRICE}`}
                    className="w-full justify-center"
                  />
                </div>
              </Card>
            </div>
          </div>
        )}

        {hasLearn && !hasRun && (
          <div id="pricing" className="mt-10 scroll-mt-20">
            <Card className="p-6 text-center">
              <span className="chip bg-[var(--blue)] text-white">Add the Run tier</span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
                Run the account, don&rsquo;t just read about it. ₹{RUN_PRICE}.
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-[var(--text-muted)]">
                A simulated Google Ads account where every search is auctioned individually.
                Seven graded missions across Search, Performance Max and App campaigns, in two
                different businesses.
              </p>
              <div className="mt-5 flex justify-center">
                <CheckoutButton
                  product="run"
                  courseId="google-ads"
                  label={`Unlock Run — ₹${RUN_PRICE}`}
                  size="lg"
                />
              </div>
            </Card>
          </div>
        )}

        {/* Run */}
        <div className="mt-10 mb-3 flex items-center gap-2">
          <span className={cn('chip', runUnlocked ? 'bg-[var(--green)] text-white' : 'bg-[var(--surface-3)] text-[var(--text-muted)]')}>
            Run
          </span>
          <span className="text-xs text-[var(--text-faint)]">The hands-on account simulator.</span>
        </div>
        <Link href={runUnlocked || !learnComplete || hasRun ? '/courses/google-ads/run' : '#pricing'}>
          <Card hover className="flex items-center gap-4 p-5">
            <span
              className={cn(
                'grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-[var(--ink)]',
                runUnlocked ? 'bg-[var(--green)] text-white' : 'bg-[var(--surface-3)] text-[var(--text-muted)]',
              )}
            >
              {runUnlocked ? <PartyPopper size={22} /> : <Lock size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold">
                {runUnlocked
                  ? 'Run is unlocked'
                  : hasRun
                    ? `Run. Finish all ${GOOGLE_AVAILABLE_LESSONS} Learn lessons to open it`
                    : learnComplete
                      ? `Run, ₹${RUN_PRICE} to unlock`
                      : 'Run. Locked until Learn is complete'}
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                {runUnlocked
                  ? 'Seven graded missions across Search, Performance Max and App campaigns.'
                  : hasRun
                    ? 'You own it. The lessons come first, because the missions assume them.'
                    : learnComplete
                      ? 'You finished Learn. Pay to step into the account simulator.'
                      : `Finish all ${GOOGLE_AVAILABLE_LESSONS} Learn lessons to unlock it.`}
              </div>
            </div>
            <ArrowRight size={18} className="shrink-0 text-[var(--text-faint)]" />
          </Card>
        </Link>
      </div>
    </div>
  );
}
