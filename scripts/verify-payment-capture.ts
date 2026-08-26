/**
 * The capture half of the money path, end to end, against a running server.
 *
 * NOT part of `npm run check` — it needs a live server and a database it is allowed
 * to write to. `scripts/validate-payments.ts` covers everything checkable without
 * those. This covers what is left: that a signed capture actually grants what was
 * bought, that a retried webhook does not grant it twice, and that two courses do
 * not bleed into each other.
 *
 * The signatures are crafted locally with the account's own test secrets, which is
 * exactly what Razorpay sends. The check is no weaker for it — same HMAC, same
 * string. What it cannot cover is Razorpay's own card capture, which needs a person
 * and a test card in the Checkout modal.
 *
 * Usage, with a local server on :3117 and a throwaway database:
 *
 *   set -a; . ./.env; set +a
 *   DATABASE_URL=postgresql://…/scratch npx tsx scripts/verify-payment-capture.ts
 */

import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';


/**
 * Refuses to run anywhere but a local database.
 *
 * This script deletes Payment rows to make itself repeatable, which against a
 * production database would destroy the audit trail for real purchases. The guard
 * is deliberately dumb and deliberately loud: a hostname allowlist, checked before
 * anything else happens.
 */
function refuseNonLocal(): void {
  const url = process.env.DATABASE_URL ?? '';
  const host = (() => {
    try { return new URL(url).hostname; } catch { return ''; }
  })();
  const LOCAL = new Set(['localhost', '127.0.0.1', '::1']);
  if (!LOCAL.has(host)) {
    console.error(
      `Refusing to run: DATABASE_URL points at "${host || '(unparseable)'}", not localhost.\n`
      + 'This script deletes Payment rows. Point it at a throwaway database.',
    );
    process.exit(1);
  }
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !process.env.RAZORPAY_KEY_SECRET) {
    console.error('Refusing to run: RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET must be set.');
    process.exit(1);
  }
}

const BASE = 'http://localhost:3117';
const prisma = new PrismaClient();
const results: string[] = [];
let failed = 0;

function check(label: string, ok: boolean, detail: string) {
  results.push(`  ${ok ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
  if (!ok) failed++;
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo@123' }),
  });
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error(`no session cookie for ${email}`);
  return cookie;
}

async function createOrder(cookie: string, product: string, courseId: string) {
  const res = await fetch(`${BASE}/api/payments/create-order`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ product, courseId }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function entitlements(email: string, courseId: string) {
  const p = await prisma.profile.findUniqueOrThrow({
    where: { email }, select: { id: true, enrollments: { where: { courseId } } },
  });
  const e = p.enrollments[0];
  return { profileId: p.id, learn: Boolean(e?.learnPurchasedAt), run: Boolean(e?.runPurchasedAt) };
}

async function main() {
  refuseNonLocal();

  const EMAIL = 'fresh@tiramisu.com';
  const COURSE = 'google-ads';

  // Reset so the run is repeatable and starts from "owns nothing".
  const { profileId } = await entitlements(EMAIL, COURSE);
  await prisma.payment.deleteMany({ where: { profileId } });
  await prisma.enrollment.updateMany({
    where: { profileId, courseId: COURSE },
    data: { learnPurchasedAt: null, runPurchasedAt: null },
  });

  const cookie = await login(EMAIL);

  // ── webhook path ──────────────────────────────────────────────────────
  const order = await createOrder(cookie, 'bundle', COURSE);
  check('an order is created for the bundle',
    order.status === 200 && order.body.amount === 249900,
    `${order.status}, ${order.body.amount} paise for ${order.body.orderId}`);

  const orderId = order.body.orderId as string;
  const paymentId = `pay_TEST${Date.now()}`;
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: 249900 } } },
  });
  const sign = (b: string, secret: string) => createHmac('sha256', secret).update(b).digest('hex');

  // A forged delivery must change nothing.
  const forged = await fetch(`${BASE}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': sign(body, 'wrong_secret') },
    body,
  });
  const afterForged = await entitlements(EMAIL, COURSE);
  check('a webhook with a bad signature is rejected and grants nothing',
    forged.status === 400 && !afterForged.learn && !afterForged.run,
    `${forged.status}, learn=${afterForged.learn} run=${afterForged.run}`);

  const real = await fetch(`${BASE}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': sign(body, process.env.RAZORPAY_WEBHOOK_SECRET!),
    },
    body,
  });
  const afterReal = await entitlements(EMAIL, COURSE);
  check('a signed payment.captured grants the bundle',
    real.status === 200 && afterReal.learn && afterReal.run,
    `${real.status}, learn=${afterReal.learn} run=${afterReal.run}`);

  const paid = await prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });
  check('the payment row records what was paid',
    paid?.status === 'paid' && paid.razorpayPaymentId === paymentId && paid.courseId === COURSE,
    `status=${paid?.status} course=${paid?.courseId} paymentId=${paid?.razorpayPaymentId}`);

  // Razorpay retries webhooks. A retry must not grant twice or overwrite the timestamp.
  const firstGrant = (await prisma.enrollment.findFirstOrThrow({
    where: { profileId, courseId: COURSE },
  })).learnPurchasedAt;
  await new Promise((r) => setTimeout(r, 30));
  const retry = await fetch(`${BASE}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': sign(body, process.env.RAZORPAY_WEBHOOK_SECRET!),
    },
    body,
  });
  const afterRetry = await prisma.enrollment.findFirstOrThrow({ where: { profileId, courseId: COURSE } });
  const payments = await prisma.payment.count({ where: { profileId, status: 'paid' } });
  check('a retried webhook is a no-op, not a second grant',
    retry.status === 200 && payments === 1
    && afterRetry.learnPurchasedAt?.getTime() === firstGrant?.getTime(),
    `${payments} paid row(s), grant timestamp unchanged`);

  // ── the same purchase cannot be made twice ────────────────────────────
  const again = await createOrder(cookie, 'bundle', COURSE);
  check('owning the bundle blocks buying it again',
    again.status === 400,
    `${again.status}: ${again.body.error ?? ''}`);

  const runAgain = await createOrder(cookie, 'run', COURSE);
  check('and blocks buying Run separately',
    runAgain.status === 400,
    `${runAgain.status}: ${runAgain.body.error ?? ''}`);

  // ── the browser callback path, on a second course ─────────────────────
  await prisma.payment.deleteMany({ where: { profileId, courseId: 'meta-ads' } });
  await prisma.enrollment.updateMany({
    where: { profileId, courseId: 'meta-ads' },
    data: { learnPurchasedAt: null, runPurchasedAt: null },
  });

  const metaOrder = await createOrder(cookie, 'learn', 'meta-ads');
  check('an order is created on a different course at its own price',
    metaOrder.status === 200 && metaOrder.body.amount === 49900,
    `${metaOrder.status}, ${metaOrder.body.amount} paise — Meta Learn is ₹499`);

  const metaOrderId = metaOrder.body.orderId as string;
  const metaPaymentId = `pay_TEST${Date.now()}b`;
  const verifyRes = await fetch(`${BASE}/api/payments/verify`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      razorpay_order_id: metaOrderId,
      razorpay_payment_id: metaPaymentId,
      razorpay_signature: sign(`${metaOrderId}|${metaPaymentId}`, process.env.RAZORPAY_KEY_SECRET!),
    }),
  });
  const meta = await entitlements(EMAIL, 'meta-ads');
  check('the browser callback grants Learn, and only Learn',
    verifyRes.status === 200 && meta.learn && !meta.run,
    `${verifyRes.status}, learn=${meta.learn} run=${meta.run}`);

  const badVerify = await fetch(`${BASE}/api/payments/verify`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      razorpay_order_id: metaOrderId,
      razorpay_payment_id: 'pay_FORGED',
      razorpay_signature: 'deadbeef',
    }),
  });
  check('a forged browser callback is rejected',
    badVerify.status === 400, `${badVerify.status}`);

  // ── granting the right course ─────────────────────────────────────────
  const google = await entitlements(EMAIL, 'google-ads');
  check('paying for one course does not unlock another',
    google.learn && google.run && meta.learn && !meta.run,
    'google-ads has the bundle, meta-ads has Learn only — the two did not bleed');

  console.log(results.join('\n'));
  console.log(failed ? `\n${failed} failure(s).` : `\n${results.length} capture checks passed.`);
  process.exit(failed ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
