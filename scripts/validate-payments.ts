/**
 * The money path.
 *
 * Everything here is checkable without Razorpay: the signature schemes are plain
 * HMAC over documented strings, purchase eligibility is a pure function, and the
 * prices are a table. What *cannot* be checked from here is whether Razorpay
 * accepts the key and captures the payment — that needs a real card and a real
 * account, and it is the one step a person has to do.
 *
 * So this covers the half that can regress silently. A wrong price, a product on
 * sale that has no tier behind it, a signature check that accepts anything, or a
 * grant that fires twice are all things nobody would notice until a customer was
 * charged, and all things a script can catch in a second.
 *
 * Run: npx tsx scripts/validate-payments.ts
 */

import { createHmac } from 'node:crypto';
import {
  COURSE_PRICING, FREE_MODULE_COUNT, isProduct, isProductPurchasable,
  priceOf, toPaise, type Product,
} from '../src/lib/payments/pricing';
// Safe to import statically even though the checks below rewrite the environment:
// both verifiers read process.env inside the function body rather than capturing
// it at module load, which is also what lets a deployment rotate a secret without
// a restart.
import { verifyPaymentSignature, verifyWebhookSignature } from '../src/lib/payments/razorpay';

const failures: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail: string) {
  (condition ? notes : failures).push(`  ${condition ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
}
function section(title: string) { notes.push(`\n${title}`); }

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// ═════════════════════════════════════════════════════════ prices ═══════════

section('Prices');
{
  // The figures the user actually signed off. Pinned literally rather than derived,
  // because the whole point of this check is to catch a change nobody intended.
  const EXPECTED: Record<string, Record<Product, number>> = {
    'meta-ads': { learn: 499, run: 999, bundle: 1199 },
    'google-ads': { learn: 999, run: 1999, bundle: 2499 },
  };

  for (const [courseId, expected] of Object.entries(EXPECTED)) {
    for (const [product, price] of Object.entries(expected) as [Product, number][]) {
      const actual = priceOf(courseId, product);
      check(`${courseId} ${product} costs ${inr(price)}`,
        actual === price, actual === undefined ? 'not for sale' : inr(actual));
    }
  }

  for (const [courseId, pricing] of Object.entries(COURSE_PRICING)) {
    const separate = (pricing.prices.learn ?? 0) + (pricing.prices.run ?? 0);
    const bundle = pricing.prices.bundle ?? 0;
    check(`${courseId}: the bundle is cheaper than buying both`,
      bundle > 0 && bundle < separate,
      `${inr(bundle)} against ${inr(separate)} — saves ${inr(separate - bundle)}`);
    check(`${courseId}: Run costs more than Learn`,
      (pricing.prices.run ?? 0) > (pricing.prices.learn ?? 0),
      `Learn ${inr(pricing.prices.learn ?? 0)}, Run ${inr(pricing.prices.run ?? 0)}`);
  }

  check('rupees convert to paise without rounding drift',
    toPaise(999) === 99_900 && toPaise(2499) === 249_900 && toPaise(1199) === 119_900,
    'Razorpay is billed in paise and a rounding error here is a real mischarge');
}

// ══════════════════════════════════════════ what is actually for sale ═══════

section('What is on sale');
{
  // A product must not be sellable unless the thing behind it exists. This is the
  // check that would have caught Google Ads Run being on sale before it was built,
  // and the one that catches the reverse — a tier that ships and never goes on sale.
  const RUN_TIER_BUILT = new Set(['meta-ads', 'google-ads']);

  for (const [courseId, pricing] of Object.entries(COURSE_PRICING)) {
    const sellsRun = pricing.sells.includes('run') || pricing.sells.includes('bundle');
    check(`${courseId}: sells a Run tier only if one exists`,
      sellsRun === RUN_TIER_BUILT.has(courseId),
      sellsRun ? `sells ${pricing.sells.join(', ')}` : 'Learn only');

    for (const product of pricing.sells) {
      check(`${courseId}: everything it sells has a price`,
        typeof pricing.prices[product] === 'number' && pricing.prices[product]! > 0,
        `${product} = ${pricing.prices[product]}`);
    }
  }

  check('an unknown course sells nothing',
    priceOf('sql-for-marketers', 'learn') === undefined
    && priceOf('not-a-course', 'bundle') === undefined,
    'priceOf returns undefined rather than a default');

  check('isProduct rejects anything else',
    isProduct('learn') && isProduct('run') && isProduct('bundle')
    && !isProduct('LEARN') && !isProduct('free') && !isProduct(null) && !isProduct(1),
    'the checkout route parses the product with this and nothing else');

  check('free preview is two modules',
    FREE_MODULE_COUNT === 2, `modules 1–${FREE_MODULE_COUNT}`);
}

// ═══════════════════════════════════════════ purchase eligibility ═══════════

section('Who may buy what');
{
  const can = (p: Product, learn: boolean, run: boolean, course = 'google-ads') =>
    isProductPurchasable(p, learn, run, course);

  check('a new buyer may buy Learn or the bundle, not Run alone',
    can('learn', false, false) && can('bundle', false, false) && !can('run', false, false),
    'Run is an upgrade, never a first purchase — buying it alone would strand them at the free preview');

  check('a Learn owner may buy Run, and nothing else',
    can('run', true, false) && !can('learn', true, false) && !can('bundle', true, false),
    'the bundle would re-charge them for Learn');

  check('somebody who owns both may buy nothing',
    !can('learn', true, true) && !can('run', true, true) && !can('bundle', true, true),
    'a stale tab or a direct API call used to be able to charge twice');

  check('a course that does not sell a product refuses it whatever the buyer owns',
    !isProductPurchasable('run', true, false, 'sql-for-marketers')
    && !isProductPurchasable('learn', false, false, 'not-a-course'),
    'the sells list is checked before anything else');
}

// ═════════════════════════════════════════════ signature schemes ════════════

section('Signatures');
{
  process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';

  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';
  const good = createHmac('sha256', 'test_key_secret')
    .update(`${orderId}|${paymentId}`).digest('hex');

  check('a correct checkout signature verifies',
    verifyPaymentSignature(orderId, paymentId, good),
    'HMAC-SHA256 of "orderId|paymentId" with the key secret, per Razorpay');

  check('a tampered payment id does not',
    !verifyPaymentSignature(orderId, 'pay_ATTACKER', good),
    'the id is inside the signed string, so swapping it breaks the digest');

  check('a tampered order id does not',
    !verifyPaymentSignature('order_ATTACKER', paymentId, good),
    'same on the other half');

  check('garbage does not',
    !verifyPaymentSignature(orderId, paymentId, 'deadbeef')
    && !verifyPaymentSignature(orderId, paymentId, ''),
    'including the empty string, which a length check has to reject before comparing');

  check('a signature signed with the wrong secret does not',
    !verifyPaymentSignature(orderId, paymentId,
      createHmac('sha256', 'not_the_secret').update(`${orderId}|${paymentId}`).digest('hex')),
    'the webhook secret is a different secret and must not be interchangeable here');

  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: paymentId } } } });
  const webhookSig = createHmac('sha256', 'test_webhook_secret').update(body).digest('hex');

  check('a correct webhook signature verifies',
    verifyWebhookSignature(body, webhookSig),
    'HMAC over the raw body with the webhook secret');

  check('a re-serialised body does not',
    !verifyWebhookSignature(JSON.stringify(JSON.parse(body)) + ' ', webhookSig),
    'which is why the route reads req.text() and never req.json()');

  check('the checkout secret does not sign webhooks',
    !verifyWebhookSignature(body, createHmac('sha256', 'test_key_secret').update(body).digest('hex')),
    'two secrets, two purposes');

  // With no secret configured at all, both must refuse rather than accept. A
  // half-configured deployment is the realistic case — one secret set, the other
  // forgotten — and the failure has to be "nothing verifies" rather than
  // "everything does".
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  check('an unconfigured server verifies nothing',
    !verifyPaymentSignature(orderId, paymentId, good) && !verifyWebhookSignature(body, webhookSig),
    'a missing secret must fail closed, never open');
}

// ─────────────────────────────────────────────────────────────── reporting ──

console.log(notes.join('\n'));
if (failures.length > 0) {
  console.error(`\n${failures.length} payment failure(s):\n`);
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`\n${notes.filter((n) => n.startsWith('  ok')).length} payment checks passed.`);
