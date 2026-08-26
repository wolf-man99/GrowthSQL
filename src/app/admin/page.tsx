import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import { getAdmin, isAdminConfigured } from '@/lib/auth/admin';
import { getProfileId } from '@/lib/auth/server';
import { adminSnapshot, type Distribution } from '@/lib/admin/metrics';
import { Card, SectionTitle, Stat, Empty } from '@/components/ui/primitives';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin, Tiramisu' };

/**
 * The platform's own dashboard.
 *
 * Server-rendered on every request against the operational database, so what it
 * shows is what is true right now rather than what an analytics pipeline got
 * around to aggregating. That matters most for the numbers someone will act on
 * within the hour — revenue and signups on a launch day.
 *
 * Deliberately read-only. There is no button here that changes a learner's state.
 * An admin surface that can edit is a different thing with a different threat
 * model, and nothing about reading the numbers requires it.
 */

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default async function AdminDashboard() {
  const profileId = await getProfileId();
  // The staff portal, not the learner login: someone reaching for the dashboard
  // wants the dashboard, and the learner form would land them on /courses.
  if (!profileId) redirect('/admin/login');

  const admin = await getAdmin();
  if (!admin) {
    // Two ways to not be an admin, and they deserve different answers.
    //
    // Nobody is an admin because none was ever configured: that is a deployment
    // that has not finished being set up, and returning 404 to its owner turns a
    // one-line fix into a debugging session. Named plainly instead. The
    // information it leaks — that this platform has an admin area — is worth
    // little on a deployment that currently has no admins to protect.
    //
    // Admins exist and this is not one: 404, because the existence of an admin
    // area is not something a stranger needs confirmed.
    if (isAdminConfigured()) notFound();
    return <NotConfigured />;
  }

  const s = await adminSnapshot();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link href="/courses" className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft size={15} /> Back to Tiramisu
          </Link>
          <span className="chip bg-[var(--ink)] text-white">
            <ShieldCheck size={11} /> {admin.displayName}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Platform analytics</h1>
          <p className="mt-1 text-[var(--text-muted)]">
            Read straight from the database, not from PostHog. The demo account and any
            admin are excluded from every count on this page.
          </p>
        </div>

        {/* ── Headline ─────────────────────────────────────────────────────── */}
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Learners" value={s.headline.learners.toLocaleString('en-IN')}
            hint={`${s.headline.signups7d} in the last 7 days`} />
          <Stat label="Revenue" value={rupees(s.headline.revenuePaise)} accent="var(--green)"
            hint={`${rupees(s.headline.revenue30dPaise)} in the last 30 days`} />
          <Stat label="Paying learners" value={s.headline.payingLearners.toLocaleString('en-IN')}
            accent="var(--blue)" hint={`${pct(s.headline.conversionRate)} of everyone signed up`} />
          <Stat label="Active this week" value={s.headline.active7d.toLocaleString('en-IN')}
            hint={`${s.engagement.attempts7d.toLocaleString('en-IN')} attempts in 7 days`} />
        </div>

        {/* ── Thirty days ──────────────────────────────────────────────────── */}
        <SectionTitle sub="Signups as bars, revenue as the line above them. Empty days are shown as empty rather than skipped.">
          Last 30 days
        </SectionTitle>
        <Card className="mb-8 p-5">
          <ThirtyDayChart points={s.series} />
        </Card>

        {/* ── Course funnel ────────────────────────────────────────────────── */}
        <SectionTitle sub="Where learners stop. Many finishing Learn but few buying Run is a pricing problem; the reverse is a content one.">
          Course funnel
        </SectionTitle>
        <Card className="mb-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--ink)] text-left">
                <Th>Course</Th>
                <Th numeric>Enrolled</Th>
                <Th numeric>Learn bought</Th>
                <Th numeric>Learn finished</Th>
                <Th numeric>Run bought</Th>
                <Th numeric>Run unlocked</Th>
              </tr>
            </thead>
            <tbody>
              {s.funnels.map((f) => (
                <tr key={f.courseId} className="border-b border-[var(--border-soft)] last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-bold">{f.title}</span>
                    {f.status !== 'live' && (
                      <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                        {f.status.replace('-', ' ')}
                      </span>
                    )}
                  </td>
                  <Td>{f.enrolled}</Td>
                  <Td>{f.learnPurchased}</Td>
                  <Td>{f.learnComplete}</Td>
                  <Td>{f.runPurchased}</Td>
                  <Td>{f.runUnlocked}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* ── Revenue + simulator ──────────────────────────────────────────── */}
        <div className="mb-8 grid gap-5 lg:grid-cols-2">
          <div>
            <SectionTitle sub="Abandoned means an order was created and never completed: the checkout drop-off.">
              Revenue by product
            </SectionTitle>
            <Card className="overflow-x-auto">
              {s.revenue.length === 0 ? (
                <div className="p-5"><Empty title="No orders yet" hint="This fills in on the first checkout." /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[var(--ink)] text-left">
                      <Th>Product</Th><Th numeric>Paid</Th><Th numeric>Abandoned</Th>
                      <Th numeric>Failed</Th><Th numeric>Revenue</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.revenue.map((r) => (
                      <tr key={r.product} className="border-b border-[var(--border-soft)] last:border-0">
                        <td className="px-4 py-2.5 font-bold capitalize">{r.product}</td>
                        <Td>{r.paid}</Td>
                        <Td>{r.abandoned}</Td>
                        <Td>{r.failed}</Td>
                        <Td>{rupees(r.revenuePaise)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <div>
            <SectionTitle sub="Days advanced is the honest measure of whether the simulator is being played or just opened.">
              Run simulator
            </SectionTitle>
            <Card className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <MiniStat label="Accounts opened" value={s.simulator.accounts} />
                <MiniStat label="Simulated days advanced" value={s.simulator.daysAdvanced} />
                <MiniStat label="Missions graded" value={`${s.simulator.runsGraded}`}
                  hint={`${s.simulator.missionTotal} missions available`} />
                <MiniStat label="Missions passed" value={s.simulator.runsPassed}
                  hint={s.simulator.runsGraded > 0
                    ? `${pct(s.simulator.runsPassed / s.simulator.runsGraded)} of graded runs`
                    : 'nothing graded yet'} />
              </div>
            </Card>
          </div>
        </div>

        {/* ── Who they are ─────────────────────────────────────────────────── */}
        <SectionTitle sub="Collected at signup. The only attribution the platform has that an ad blocker cannot break, because the learner typed it.">
          Where learners come from
        </SectionTitle>
        <div className="mb-8 grid gap-5 md:grid-cols-3">
          <DistributionCard title="Heard about us via" rows={s.onboarding.heardFrom} />
          <DistributionCard title="Learning in order to" rows={s.onboarding.learningGoal} />
          <DistributionCard title="Came for the course" rows={s.onboarding.courseInterest} />
        </div>

        {/* ── Engagement ───────────────────────────────────────────────────── */}
        <SectionTitle sub="Hardest concepts are ranked by total failures, not failure rate: a concept two people got wrong once is not a curriculum problem.">
          Engagement
        </SectionTitle>
        <div className="mb-8 grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <MiniStat label="Graded attempts" value={s.engagement.attempts.toLocaleString('en-IN')} />
              <MiniStat label="Pass rate" value={pct(s.engagement.passRate)} />
              <MiniStat label="Lesson sections done" value={s.engagement.lessonsCompleted.toLocaleString('en-IN')} />
              <MiniStat label="Meta lessons passed" value={s.engagement.metaLessonPasses.toLocaleString('en-IN')}
                hint={`across ${s.engagement.metaLessonTotal} lessons`} />
            </div>
          </Card>
          <DistributionCard title="Hardest concepts" rows={s.engagement.hardestConcepts}
            emptyHint="Fills in once learners start getting things wrong." />
        </div>

        {/* ── Recent signups ───────────────────────────────────────────────── */}
        <SectionTitle sub="The 25 most recent, newest first.">Recent signups</SectionTitle>
        <Card className="overflow-x-auto">
          {s.recent.length === 0 ? (
            <div className="p-5"><Empty title="Nobody has signed up yet" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--ink)] text-left">
                  <Th>Learner</Th><Th>Signed up</Th><Th>Via</Th>
                  <Th>Wants</Th><Th numeric>XP</Th><Th>Paid</Th>
                </tr>
              </thead>
              <tbody>
                {s.recent.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border-soft)] last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-bold">{r.displayName}</div>
                      <div className="text-xs text-[var(--text-faint)]">{r.email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">
                      {r.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">{r.heardFrom ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">{r.courseInterest ?? '—'}</td>
                    <Td>{r.xp}</Td>
                    <td className="px-4 py-2.5">
                      {r.paid
                        ? <span className="chip bg-[var(--green)] text-white">paid</span>
                        : <span className="text-[var(--text-faint)]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <p className="mt-6 text-xs text-[var(--text-faint)]">
          Generated {s.generatedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC. Refresh for current figures.
        </p>
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center md:px-8">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-2 border-[var(--ink)] bg-[var(--amber)] shadow-[3px_3px_0_var(--ink)]">
        <ShieldAlert size={26} className="text-[var(--ink)]" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">No admins are configured</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        This dashboard is gated on an <code className="mono">ADMIN_EMAILS</code> environment
        variable, and it is not set on this deployment. Until it is, nobody can reach this page,
        including you.
      </p>
      <div className="mt-6 rounded-xl border-2 border-[var(--ink)] bg-[var(--surface-2)] p-4 text-left">
        <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
          Set this, then redeploy
        </div>
        <code className="mono block break-all text-[13px]">ADMIN_EMAILS=you@yourdomain.com</code>
        <p className="mt-2 text-xs text-[var(--text-subtle)]">
          Comma-separated for several. The address has to match an account that already exists.
        </p>
      </div>
      <Link href="/courses" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]">
        <ArrowLeft size={14} /> Back to Tiramisu
      </Link>
    </div>
  );
}

/* ─── Pieces ───────────────────────────────────────────────────────────────── */

function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th className={`px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)] ${numeric ? 'text-right' : ''}`}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 text-right font-bold tabular-nums">{children}</td>;
}

function MiniStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 font-display text-2xl font-extrabold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-[var(--text-faint)]">{hint}</div>}
    </div>
  );
}

function DistributionCard({
  title, rows, emptyHint,
}: {
  title: string;
  rows: Distribution[];
  emptyHint?: string;
}) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <Card className="p-5">
      <div className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">{emptyHint ?? 'Nothing recorded yet.'}</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate font-semibold">{r.label}</span>
                <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                  {r.count} · {total > 0 ? pct(r.count / total) : '0%'}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full bg-[var(--blue)]"
                  style={{ width: total > 0 ? `${(r.count / total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Thirty days of signups and revenue, drawn as bars with a revenue line.
 *
 * Hand-rolled rather than pulled from a charting library: it is one series of
 * thirty values, and a dependency that ships a rendering engine to draw thirty
 * rectangles would cost more in bundle size than the whole admin route.
 *
 * Both scales are independent and both are labelled, because they measure
 * different things in different units. A shared axis would imply a relationship
 * between a signup and a rupee that does not exist.
 */
function ThirtyDayChart({ points }: { points: { day: string; signups: number; revenuePaise: number }[] }) {
  const maxSignups = Math.max(1, ...points.map((p) => p.signups));
  const maxRevenue = Math.max(1, ...points.map((p) => p.revenuePaise));
  const totalSignups = points.reduce((n, p) => n + p.signups, 0);
  const totalRevenue = points.reduce((n, p) => n + p.revenuePaise, 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span><strong className="tabular-nums">{totalSignups}</strong> signups</span>
        <span><strong className="tabular-nums text-[var(--green)]">{rupees(totalRevenue)}</strong> revenue</span>
        <span className="text-xs text-[var(--text-faint)]">peak {maxSignups} signups/day</span>
      </div>

      <div className="flex h-40 items-end gap-[3px]">
        {points.map((p) => (
          <div key={p.day} className="group relative flex flex-1 flex-col justify-end" style={{ height: '100%' }}>
            {/* Revenue stacks above the signup bar as a lighter cap, so a day that
                took money but brought nobody new is still visibly a day with money
                rather than an empty column. */}
            {p.revenuePaise > 0 && (
              <div
                className="w-full rounded-t-sm bg-[var(--green)] opacity-40"
                style={{ height: `${(p.revenuePaise / maxRevenue) * 55}%` }}
              />
            )}
            <div
              className="w-full rounded-t-sm bg-[var(--blue)]"
              style={{ height: `${Math.max(p.signups > 0 ? 4 : 1, (p.signups / maxSignups) * 100)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border-2 border-[var(--ink)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold shadow-[2px_2px_0_var(--ink)] group-hover:block">
              {p.day.slice(5)} · {p.signups} signup{p.signups === 1 ? '' : 's'}
              {p.revenuePaise > 0 && ` · ${rupees(p.revenuePaise)}`}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-[var(--text-faint)]">
        <span>{points[0]?.day}</span>
        <span>{points[points.length - 1]?.day}</span>
      </div>
    </>
  );
}
