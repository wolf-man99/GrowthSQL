/**
 * The platform's own numbers.
 *
 * Everything here reads the operational database directly rather than PostHog.
 * The two answer different questions and only one of them is authoritative about
 * money: PostHog tells you what happened in a browser, sampled and best-effort,
 * while `Payment` and `Enrollment` tell you what a learner actually owns. For
 * "how many signed up" the two roughly agree; for "how much did we take" only one
 * of them is allowed to be wrong, and it is not this one.
 *
 * Two rules the whole module follows:
 *
 *   - The demo account and every admin are excluded from learner counts. Neither
 *     is a customer, and on a launch the denominator is small enough that a
 *     handful of internal accounts moves every ratio on the page.
 *   - Money is stored and summed in paise, Razorpay's unit, and converted once at
 *     the edge. Rupee floats that get added together drift, and a revenue figure
 *     that disagrees with the payment gateway by ₹0.03 costs more time to explain
 *     than it will ever save.
 */

import { prisma } from '@/lib/db';
import { COURSES } from '@/lib/courses/registry';
import { META_LESSONS } from '@/lib/content/meta-ads';
import { MISSIONS } from '@/lib/simulator/missions';

/**
 * Real learners only.
 *
 * Two exclusions, for the same reason: neither is a customer, and on a launch
 * where the denominator is small a handful of internal accounts moves every ratio
 * on the page. The demo login is entitled to every course by construction, and
 * admins are staff.
 *
 * Admins are matched by the same `ADMIN_EMAILS` list that grants the access, so
 * there is one place to change and no second list to fall out of step with it.
 */
function realLearner() {
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.length > 0
    ? { isDemo: false, email: { notIn: admins } }
    : { isDemo: false };
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────────────────────── headline ──

export interface Headline {
  learners: number;
  signups7d: number;
  signups30d: number;
  /** Distinct learners with at least one paid payment. */
  payingLearners: number;
  /** Paid learners over total learners. The number that decides whether this is a
   *  business or a hobby. */
  conversionRate: number;
  revenuePaise: number;
  revenue30dPaise: number;
  /** Learners with recorded activity in the last 7 days. */
  active7d: number;
}

export async function headline(): Promise<Headline> {
  const [learners, signups7d, signups30d, payers, revenue, revenue30d, active] = await Promise.all([
    prisma.profile.count({ where: realLearner() }),
    prisma.profile.count({ where: { ...realLearner(), createdAt: { gte: daysAgo(7) } } }),
    prisma.profile.count({ where: { ...realLearner(), createdAt: { gte: daysAgo(30) } } }),
    // Distinct, because one learner buying Learn then Run is one customer, not two.
    prisma.payment.findMany({
      where: { status: 'paid', profile: realLearner() },
      select: { profileId: true },
      distinct: ['profileId'],
    }),
    prisma.payment.aggregate({
      where: { status: 'paid', profile: realLearner() },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'paid', profile: realLearner(), paidAt: { gte: daysAgo(30) } },
      _sum: { amount: true },
    }),
    prisma.dailyActivity.findMany({
      where: { date: { gte: isoDay(daysAgo(7)) }, profile: realLearner() },
      select: { profileId: true },
      distinct: ['profileId'],
    }),
  ]);

  return {
    learners,
    signups7d,
    signups30d,
    payingLearners: payers.length,
    conversionRate: learners > 0 ? payers.length / learners : 0,
    revenuePaise: revenue._sum.amount ?? 0,
    revenue30dPaise: revenue30d._sum.amount ?? 0,
    active7d: active.length,
  };
}

// ───────────────────────────────────────────────────────────── time series ──

export interface DayPoint {
  day: string;
  signups: number;
  revenuePaise: number;
}

/**
 * Signups and revenue by day, with empty days present rather than absent.
 *
 * A series that skips quiet days draws a chart that lies about its own shape: two
 * points a fortnight apart join with a straight line that implies activity in
 * between. Filling the gaps here means the chart cannot make that mistake.
 */
export async function dailySeries(days = 30): Promise<DayPoint[]> {
  const since = daysAgo(days - 1);

  // The same exclusions as realLearner(), expressed in SQL because these two are
  // raw: grouping by day is not something Prisma's groupBy can express. A single
  // empty-list sentinel keeps the parameter shape constant, since `NOT IN ()` is
  // a syntax error in Postgres rather than a no-op.
  const excluded = (process.env.ADMIN_EMAILS ?? '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const notAdmin = excluded.length > 0 ? excluded : ['\u0000never-matches'];

  const [signupRows, revenueRows] = await Promise.all([
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, count(*) AS n
      FROM "Profile"
      WHERE "isDemo" = false
        AND lower(coalesce(email, '')) <> ALL(${notAdmin}::text[])
        AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<{ day: Date; paise: bigint }[]>`
      SELECT date_trunc('day', p."paidAt") AS day, sum(p.amount) AS paise
      FROM "Payment" p
      JOIN "Profile" pr ON pr.id = p."profileId"
      WHERE p.status = 'paid'
        AND pr."isDemo" = false
        AND lower(coalesce(pr.email, '')) <> ALL(${notAdmin}::text[])
        AND p."paidAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
  ]);

  const signups = new Map(signupRows.map((r) => [isoDay(r.day), Number(r.n)]));
  const revenue = new Map(revenueRows.map((r) => [isoDay(r.day), Number(r.paise)]));

  const out: DayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = daysAgo(days - 1 - i);
    const key = isoDay(d);
    out.push({ day: key, signups: signups.get(key) ?? 0, revenuePaise: revenue.get(key) ?? 0 });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────── funnel ──

export interface CourseFunnel {
  courseId: string;
  title: string;
  status: string;
  enrolled: number;
  learnPurchased: number;
  learnComplete: number;
  runPurchased: number;
  runUnlocked: number;
}

/**
 * Where learners stop, per course.
 *
 * `learnComplete` counts `runUnlockedAt`, which is set the moment every Learn
 * lesson has been passed — independently of whether Run was ever bought. That is
 * the honest measure of finishing the theory, and keeping it separate from
 * `runPurchased` is what makes the two adjacent numbers a diagnosis: many
 * complete and few purchased is a pricing problem, the reverse is a content one.
 */
export async function courseFunnels(): Promise<CourseFunnel[]> {
  const rows = await prisma.enrollment.groupBy({
    by: ['courseId'],
    where: { profile: realLearner() },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((r) => [r.courseId, r._count._all]));

  const detail = await Promise.all(
    COURSES.map(async (c) => {
      const [learnPurchased, learnComplete, runPurchased, runUnlocked] = await Promise.all([
        prisma.enrollment.count({ where: { courseId: c.id, learnPurchasedAt: { not: null }, profile: realLearner() } }),
        prisma.enrollment.count({ where: { courseId: c.id, runUnlockedAt: { not: null }, profile: realLearner() } }),
        prisma.enrollment.count({ where: { courseId: c.id, runPurchasedAt: { not: null }, profile: realLearner() } }),
        prisma.enrollment.count({
          where: { courseId: c.id, runUnlockedAt: { not: null }, runPurchasedAt: { not: null }, profile: realLearner() },
        }),
      ]);
      return {
        courseId: c.id,
        title: c.title,
        status: c.status,
        enrolled: counts.get(c.id) ?? 0,
        learnPurchased,
        learnComplete,
        runPurchased,
        runUnlocked,
      };
    }),
  );

  // Courses nobody has touched sink to the bottom rather than being hidden: a
  // launched course with zero enrolments is information, not noise.
  return detail.sort((a, b) => b.enrolled - a.enrolled);
}

// ────────────────────────────────────────────────────────────────── revenue ──

export interface ProductRevenue {
  product: string;
  paid: number;
  /** Orders created but never completed. The checkout drop-off, in absolute terms. */
  abandoned: number;
  failed: number;
  revenuePaise: number;
}

export async function revenueByProduct(): Promise<ProductRevenue[]> {
  const rows = await prisma.payment.groupBy({
    by: ['product', 'status'],
    where: { profile: realLearner() },
    _count: { _all: true },
    _sum: { amount: true },
  });

  const byProduct = new Map<string, ProductRevenue>();
  for (const r of rows) {
    const cur = byProduct.get(r.product)
      ?? { product: r.product, paid: 0, abandoned: 0, failed: 0, revenuePaise: 0 };
    if (r.status === 'paid') {
      cur.paid += r._count._all;
      cur.revenuePaise += r._sum.amount ?? 0;
    } else if (r.status === 'failed') {
      cur.failed += r._count._all;
    } else {
      // 'created' and never advanced: the learner opened checkout and walked away.
      cur.abandoned += r._count._all;
    }
    byProduct.set(r.product, cur);
  }
  return Array.from(byProduct.values()).sort((a, b) => b.revenuePaise - a.revenuePaise);
}

// ──────────────────────────────────────────────────────────── who they are ──

export interface Distribution {
  label: string;
  count: number;
}

/**
 * The three questions signup asks and nothing has ever read back.
 *
 * `heardFrom` is the one that pays for itself on a launch: it is the only
 * attribution the platform has that survives ad blockers, because the learner
 * typed it rather than a pixel inferring it.
 */
export async function onboardingBreakdowns(): Promise<{
  heardFrom: Distribution[];
  learningGoal: Distribution[];
  courseInterest: Distribution[];
}> {
  const group = async (field: 'heardFrom' | 'learningGoal' | 'courseInterest') => {
    const rows = await prisma.profile.groupBy({
      by: [field],
      where: { ...realLearner(), [field]: { not: null } },
      _count: { _all: true },
    });
    return rows
      .map((r) => ({ label: String(r[field] ?? 'unknown'), count: r._count._all }))
      .sort((a, b) => b.count - a.count);
  };

  const [heardFrom, learningGoal, courseInterest] = await Promise.all([
    group('heardFrom'), group('learningGoal'), group('courseInterest'),
  ]);
  return { heardFrom, learningGoal, courseInterest };
}

// ─────────────────────────────────────────────────────────────── engagement ──

export interface Engagement {
  attempts: number;
  passRate: number;
  attempts7d: number;
  lessonsCompleted: number;
  /** Meta Ads lessons passed at least once, across all learners. */
  metaLessonPasses: number;
  metaLessonTotal: number;
  /** Concepts learners get wrong most, from the coach's own diagnosis codes. */
  hardestConcepts: Distribution[];
}

export async function engagement(): Promise<Engagement> {
  const [attempts, passed, attempts7d, lessonsCompleted, metaPasses, conceptRows] = await Promise.all([
    prisma.attempt.count({ where: { profile: realLearner() } }),
    prisma.attempt.count({ where: { passed: true, profile: realLearner() } }),
    prisma.attempt.count({ where: { createdAt: { gte: daysAgo(7) }, profile: realLearner() } }),
    prisma.lessonProgress.count({ where: { status: 'complete', profile: realLearner() } }),
    prisma.attempt.count({
      where: { courseId: 'meta-ads', itemType: 'lesson', passed: true, profile: realLearner() },
    }),
    prisma.conceptStat.groupBy({
      by: ['concept'],
      where: { profile: realLearner() },
      _sum: { attempts: true, passes: true },
    }),
  ]);

  // Ranked by failures rather than by failure *rate*: a concept two people got
  // wrong once is not a curriculum problem, and a rate would put it top.
  const hardestConcepts = conceptRows
    .map((r) => ({
      label: r.concept,
      count: Math.max(0, (r._sum.attempts ?? 0) - (r._sum.passes ?? 0)),
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    attempts,
    passRate: attempts > 0 ? passed / attempts : 0,
    attempts7d,
    lessonsCompleted,
    metaLessonPasses: metaPasses,
    metaLessonTotal: META_LESSONS.length,
    hardestConcepts,
  };
}

// ──────────────────────────────────────────────────────── the Run simulator ──

export interface SimulatorUsage {
  accounts: number;
  sandboxes: number;
  /** Simulated days advanced across every account: the clearest single measure of
   *  whether anyone is actually playing rather than just opening it. */
  daysAdvanced: number;
  runsGraded: number;
  runsPassed: number;
  missionTotal: number;
}

export async function simulatorUsage(): Promise<SimulatorUsage> {
  const [accounts, sandboxes, dayAgg, graded, passed] = await Promise.all([
    prisma.simAccount.count({ where: { profile: realLearner() } }),
    prisma.simAccount.count({ where: { missionId: null, profile: realLearner() } }),
    prisma.simAccount.aggregate({ where: { profile: realLearner() }, _sum: { currentDay: true } }),
    prisma.missionRun.count({ where: { gradedAt: { not: null }, profile: realLearner() } }),
    prisma.missionRun.count({ where: { status: 'passed', profile: realLearner() } }),
  ]);

  return {
    accounts,
    sandboxes,
    daysAdvanced: dayAgg._sum.currentDay ?? 0,
    runsGraded: graded,
    runsPassed: passed,
    missionTotal: MISSIONS.length,
  };
}

// ─────────────────────────────────────────────────────────── recent signups ──

export interface RecentLearner {
  id: string;
  displayName: string;
  email: string | null;
  createdAt: Date;
  xp: number;
  level: number;
  provider: string;
  heardFrom: string | null;
  courseInterest: string | null;
  /** Whether they have paid for anything. */
  paid: boolean;
}

export async function recentSignups(limit = 25): Promise<RecentLearner[]> {
  const profiles = await prisma.profile.findMany({
    where: realLearner(),
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, displayName: true, email: true, createdAt: true, xp: true, level: true,
      provider: true, heardFrom: true, courseInterest: true,
      payments: { where: { status: 'paid' }, select: { id: true }, take: 1 },
    },
  });

  return profiles.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    email: p.email,
    createdAt: p.createdAt,
    xp: p.xp,
    level: p.level,
    provider: p.provider,
    heardFrom: p.heardFrom,
    courseInterest: p.courseInterest,
    paid: p.payments.length > 0,
  }));
}

// ───────────────────────────────────────────────────────────────── the lot ──

export interface AdminSnapshot {
  headline: Headline;
  series: DayPoint[];
  funnels: CourseFunnel[];
  revenue: ProductRevenue[];
  onboarding: Awaited<ReturnType<typeof onboardingBreakdowns>>;
  engagement: Engagement;
  simulator: SimulatorUsage;
  recent: RecentLearner[];
  generatedAt: Date;
}

/**
 * Everything the dashboard shows, in one round of parallel queries.
 *
 * Parallel is safe here for the same reason it is elsewhere in the app:
 * DATABASE_URL carries pgbouncer=true, so Prisma never relies on server-side
 * prepared statements that transaction-mode pooling would break.
 */
export async function adminSnapshot(): Promise<AdminSnapshot> {
  const [head, series, funnels, revenue, onboarding, eng, simulator, recent] = await Promise.all([
    headline(), dailySeries(30), courseFunnels(), revenueByProduct(),
    onboardingBreakdowns(), engagement(), simulatorUsage(), recentSignups(),
  ]);

  return {
    headline: head, series, funnels, revenue, onboarding,
    engagement: eng, simulator, recent, generatedAt: new Date(),
  };
}
