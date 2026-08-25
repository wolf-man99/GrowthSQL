import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { COURSES } from '@/lib/courses/registry';
import { getCurrentProfile } from '@/lib/auth/server';
import { CourseCard } from '@/components/app/CourseCard';
import { SiteHeader, SiteFooter } from '@/components/marketing/SiteChrome';
import { entitlementsFor } from '@/lib/payments/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Courses - Tiramisu' };

export default async function CoursesPage() {
  const profile = await getCurrentProfile();
  const authed = Boolean(profile);
  const live = COURSES.filter((c) => c.status === 'live');
  const upcoming = COURSES.filter((c) => c.status !== 'live');

  // Only Meta Ads has real pricing today, a signed-in click on its card opens a
  // pricing dialog instead of navigating straight in. A missing Enrollment row
  // (never visited the course yet) just means nothing's been purchased.
  const metaAdsPricing = profile
    ? await entitlementsFor(profile.id, 'meta-ads')
    : undefined;

  return (
    <div className="min-h-screen">
      <SiteHeader authed={authed} />

      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft size={15} /> Home
        </Link>

        {/* Hero */}
        <div className="max-w-3xl">
          <div className="eyebrow mb-2">The curriculum</div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Build your performance marketing stack.
          </h1>
          <p className="mt-4 text-lg text-[var(--text-muted)]">
            Learn the tools. Understand the systems. Practice the decisions.
          </p>
        </div>

        {/* What you can start today */}
        {live.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wide">Start today</h2>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              {live.length === 1 ? 'One course is' : `${live.length} courses are`} live and fully playable right now.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {live.map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  recommended={c.id === profile?.courseInterest}
                  pricing={c.id === 'meta-ads' ? metaAdsPricing : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {/* On the way */}
        {upcoming.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wide">Coming soon</h2>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              More platforms are on the way. Get notified when they launch.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
          </section>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
