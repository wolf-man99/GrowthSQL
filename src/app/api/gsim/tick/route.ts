import { advanceGDays, MAX_ADVANCE_DAYS } from '@/lib/gsim/account';
import { requireGoogleRunAccess, requireOwnedGAccount } from '@/lib/gsim/guard';

export const runtime = 'nodejs';
// Fourteen days of a busy account is a few hundred thousand simulated auctions.
export const maxDuration = 60;

/**
 * Advances an account by one or more days.
 *
 * The clock only moves forward, and only here. Days are clamped server-side rather
 * than trusted from the body, because the engine simulates every search in a day
 * individually and an unbounded request is a way to hold a connection open while
 * it grinds.
 */
export async function POST(req: Request) {
  const auth = await requireGoogleRunAccess();
  if (!auth.ok) return auth.response;

  let body: { accountId?: string; days?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const owned = await requireOwnedGAccount(body.accountId, auth.profileId);
  if (!owned.ok) return owned.response;

  if (owned.account.status !== 'active') {
    return Response.json(
      { error: 'This account is finished. Start a new run to keep going.' },
      { status: 409 },
    );
  }

  const days = Math.min(body.days ?? 1, MAX_ADVANCE_DAYS);
  const outcome = await advanceGDays(owned.account, days);

  return Response.json({
    ok: true,
    currentDay: outcome.account.currentDay,
    state: outcome.account.state,
    results: outcome.results,
  });
}
