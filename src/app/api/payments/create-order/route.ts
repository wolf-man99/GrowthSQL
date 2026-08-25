import { prisma } from '@/lib/db';
import { getProfileId } from '@/lib/auth/server';
import { ensureEnrollment } from '@/lib/progress/persist';
import { createRazorpayOrder, isRazorpayConfigured } from '@/lib/payments/razorpay';
import { META_ADS_PRICING, isProduct, isProductPurchasable, toPaise } from '@/lib/payments/pricing';
import { entitlementsFor } from '@/lib/payments/entitlements';

export const runtime = 'nodejs';

/**
 * Starts a Razorpay checkout: creates the Order (amount looked up server-side, never
 * trusting the client) and a matching Payment audit row, then hands the client just
 * enough to open Checkout.js. The actual entitlement is granted later, once the
 * payment is verified. See /api/payments/verify and /api/payments/webhook.
 */
export async function POST(req: Request) {
  const profileId = await getProfileId();
  if (!profileId) return Response.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isRazorpayConfigured()) return Response.json({ error: 'Checkout is not set up yet.' }, { status: 503 });

  let body: { product?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!isProduct(body.product)) {
    return Response.json({ error: 'product must be one of learn, run, bundle.' }, { status: 400 });
  }
  const product = body.product;

  await ensureEnrollment(profileId, 'meta-ads');
  const { hasLearn, hasRun, isDemo } = await entitlementsFor(profileId, 'meta-ads');
  if (!isProductPurchasable(product, hasLearn, hasRun)) {
    // The demo account owns everything by definition, so it lands here rather than
    // in Razorpay. Worth its own wording: "you already own Learn" would read as a
    // bug to whoever is demoing, when it is the account working as intended.
    const reason =
      isDemo ? 'The demo account already has every course. Checkout is disabled on it.'
      : product === 'learn' ? 'You already own Learn.'
      : product === 'run' ? (hasRun ? 'You already own Run.' : 'Buy Learn first - Run isn\'t sold on its own.')
      : 'You already own Learn. Buy Run instead of the bundle.';
    return Response.json({ error: reason }, { status: 400 });
  }

  const amount = toPaise(META_ADS_PRICING[product]);

  let order;
  try {
    order = await createRazorpayOrder(amount, `${profileId.slice(0, 12)}-${product}-${Date.now()}`, {
      profileId, courseId: 'meta-ads', product,
    });
  } catch {
    return Response.json({ error: 'Could not start checkout. Try again.' }, { status: 502 });
  }

  await prisma.payment.create({
    data: { profileId, courseId: 'meta-ads', product, amount, razorpayOrderId: order.id, status: 'created' },
  });

  return Response.json({
    orderId: order.id, amount: order.amount, currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
}
