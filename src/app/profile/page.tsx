import Link from 'next/link';
import { ArrowLeft, CalendarDays, Flame, Mail, Trophy, Zap } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireProfileId } from '@/lib/auth/server';
import { COURSES } from '@/lib/courses/registry';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { ProfileForm } from '@/components/app/ProfileForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your profile - Tiramisu' };

/**
 * A learner's own record of themselves.
 *
 * Reads first, edits second — the reason to open this page is usually to check
 * something rather than change it, so the details render as a record and become a
 * form only on request.
 *
 * "Member since" carries more weight than it looks. It is the only place the
 * platform tells someone how long they have been at this, and on a learning
 * product that is the number people are quietly proud of.
 */
export default async function ProfilePage() {
  const profileId = await requireProfileId('/profile');

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: {
      displayName: true, email: true, phone: true, provider: true, createdAt: true,
      xp: true, level: true, title: true, currentStreak: true, longestStreak: true,
      courseInterest: true, learningGoal: true,
      enrollments: {
        select: { courseId: true, startedAt: true, learnPurchasedAt: true, runPurchasedAt: true },
      },
    },
  });

  const joined = profile.createdAt;
  const days = Math.max(1, Math.floor((Date.now() - joined.getTime()) / 86_400_000));
  const courseTitle = (id: string) => COURSES.find((c) => c.id === id)?.title ?? id;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5 md:px-8">
          <Link href="/courses" className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft size={15} /> Back to Tiramisu
          </Link>
          <span className="flex items-center gap-1.5 rounded-full border-2 border-[var(--ink)] bg-[var(--purple)] px-3 py-1 text-[13px] font-bold text-white">
            <Zap size={13} /> {profile.xp} XP
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
        <div className="mb-8 flex items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-[var(--ink)] bg-[var(--purple)] text-2xl font-extrabold text-white shadow-[3px_3px_0_var(--ink)]">
            {profile.displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight">{profile.displayName}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><Trophy size={13} /> Level {profile.level} · {profile.title}</span>
              <span className="flex items-center gap-1"><CalendarDays size={13} /> Member for {days} day{days === 1 ? '' : 's'}</span>
            </p>
          </div>
        </div>

        {/* ── Details ──────────────────────────────────────────────────────── */}
        <SectionTitle sub="Your email is how you sign in, so it is not editable here.">
          Your details
        </SectionTitle>
        <Card className="mb-8 p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-soft)] pb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">Email</span>
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <Mail size={13} className="text-[var(--text-faint)]" />
              {profile.email ?? 'Not set'}
              {profile.provider === 'google' && (
                <span className="chip bg-[var(--surface-3)] text-[var(--text-muted)]">via Google</span>
              )}
            </span>
          </div>
          <ProfileForm displayName={profile.displayName} phone={profile.phone} />
        </Card>

        {/* ── Membership ───────────────────────────────────────────────────── */}
        <SectionTitle sub="How long you have been here, and what you have built up.">
          Membership
        </SectionTitle>
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            icon={<CalendarDays size={15} />}
            label="Joined"
            value={joined.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            hint={`${days} day${days === 1 ? '' : 's'} ago`}
          />
          <Fact icon={<Zap size={15} />} label="Total XP" value={profile.xp.toLocaleString('en-IN')} hint={`Level ${profile.level}`} />
          <Fact
            icon={<Flame size={15} />}
            label="Current streak"
            value={`${profile.currentStreak} day${profile.currentStreak === 1 ? '' : 's'}`}
            hint={`Best: ${profile.longestStreak}`}
          />
          <Fact icon={<Trophy size={15} />} label="Title" value={profile.title} hint={`Level ${profile.level}`} />
        </div>

        {/* ── Courses ──────────────────────────────────────────────────────── */}
        <SectionTitle sub="Every course you have opened, and what you own on it.">
          Your courses
        </SectionTitle>
        <Card className="mb-8 p-5">
          {profile.enrollments.length === 0 ? (
            <p className="text-sm text-[var(--text-faint)]">
              You have not opened a course yet. <Link href="/courses" className="font-bold text-[var(--accent-text)] hover:underline">Browse the catalogue</Link>.
            </p>
          ) : (
            <div className="grid gap-3">
              {profile.enrollments.map((e) => (
                <div key={e.courseId} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-bold">{courseTitle(e.courseId)}</div>
                    <div className="text-xs text-[var(--text-faint)]">
                      Started {e.startedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {e.learnPurchasedAt && <span className="chip bg-[var(--blue)] text-white">Learn</span>}
                    {e.runPurchasedAt && <span className="chip bg-[var(--green)] text-white">Run</span>}
                    {!e.learnPurchasedAt && !e.runPurchasedAt && (
                      <span className="chip bg-[var(--surface-3)] text-[var(--text-muted)]">Free preview</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Fact({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
        <span className="text-[var(--text-faint)]">{icon}</span> {label}
      </div>
      <div className="mt-1 font-display text-xl font-extrabold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-[var(--text-faint)]">{hint}</div>}
    </Card>
  );
}
