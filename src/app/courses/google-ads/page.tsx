import Link from 'next/link';
import { ArrowLeft, Check, Clock, Lock, Play, Rocket, Sparkles, Zap } from 'lucide-react';
import {
  GOOGLE_MODULES, GOOGLE_LESSONS, GOOGLE_AVAILABLE_LESSONS, GOOGLE_TOTAL_XP,
} from '@/lib/content/google-ads';
import { prisma } from '@/lib/db';
import { requireProfileId } from '@/lib/auth/server';
import { ensureEnrollment } from '@/lib/progress/persist';
import { entitlementsFor } from '@/lib/payments/entitlements';
import { FREE_MODULE_COUNT, priceOf } from '@/lib/payments/pricing';
import { Card, Progress } from '@/components/ui/primitives';
import { CourseLogo } from '@/components/app/CourseLogo';
import { CheckoutButton } from '@/components/payments/CheckoutButton';
import { cn } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Google Ads - Tiramisu' };

const LEARN_PRICE = priceOf('google-ads', 'learn') ?? 0;

/**
 * The Google Ads course home.
 *
 * Structurally a sibling of the Meta Ads page rather than a copy of it: same
 * module list, same progress bar, same free-preview gate. The difference is that
 * this course has no Run tier yet, so instead of a locked simulator card at the
 * bottom it says so plainly. Showing a greyed-out "Run" panel for something that
 * has not been built would read as a paywall rather than as an absence.
 */
export default async function GoogleAdsHome() {
  const profileId = await requireProfileId('/courses/google-ads');
  await ensureEnrollment(profileId, 'google-ads');

  // Parallel is safe: DATABASE_URL carries pgbouncer=true, so Prisma never relies
  // on server-side prepared statements. See the fuller note in the Meta Ads page.
  const [profile, done, entitlements] = await Promise.all([
    prisma.profile.findUniqueOrThrow({ where: { id: profileId } }),
    prisma.attempt.findMany({
      where: { profileId, courseId: 'google-ads', itemType: 'lesson', passed: true },
      select: { itemId: true },
    }),
    entitlementsFor(profileId, 'google-ads'),
  ]);

  const { hasLearn } = entitlements;
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

        {/* Pricing */}
        {!hasLearn && (
          <div id="pricing" className="mt-10 scroll-mt-20">
            <Card className="p-6 text-center">
              <span className="chip bg-[var(--green)] text-white">Unlock the full course</span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
                Modules 1–{FREE_MODULE_COUNT} are free. The rest is ₹{LEARN_PRICE}, once.
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[var(--text-muted)]">
                All {GOOGLE_AVAILABLE_LESSONS} lessons, {GOOGLE_TOTAL_XP} XP, and every calculator.
                No subscription, no expiry.
              </p>
              <div className="mt-5 flex justify-center">
                <CheckoutButton
                  product="learn"
                  courseId="google-ads"
                  label={`Unlock Google Ads - ₹${LEARN_PRICE}`}
                  size="lg"
                />
              </div>
            </Card>
          </div>
        )}

        {/* What comes next. Stated as an absence rather than shown as a locked
            panel, because there is nothing behind it to unlock yet. */}
        <div className="mt-10">
          <Card className="flex items-center gap-4 border-dashed p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-dashed border-[var(--ink)] bg-[var(--surface-2)] text-[var(--text-muted)]">
              <Rocket size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold">A Run tier for Search is being built</div>
              <div className="text-sm text-[var(--text-muted)]">
                {learnComplete
                  ? 'You have finished Learn. The hands-on Search account simulator is next, and it is not ready yet.'
                  : 'Meta Ads already has one. Search needs its own — the auction works differently enough that it cannot be a reskin.'}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
