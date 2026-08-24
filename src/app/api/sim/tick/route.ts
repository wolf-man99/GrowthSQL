import { advanceDays } from '@/lib/simulator/account';
import { requireOwnedAccount, requireRunAccess } from '@/lib/simulator/guard';

export const runtime = 'nodejs';

/**
 * Advances a simulated account by one or more days.
 *
 * The clock only ever moves forward, and only here. Days are capped server-side
 * (advanceDays clamps to 30) so a crafted request cannot ask for ten thousand
 * ticks and hold a connection open while the engine grinds through them.
 */
export async function POST(req: Request) {
  const auth = await requireRunAccess();
  if (!auth.ok) return auth.response;

  let body: { accountId?: string; days?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const owned = await requireOwnedAccount(body.accountId, auth.profileId);
  if (!owned.ok) return owned.response;

  if (owned.account.status !== 'active') {
    return Response.json({ error: 'This account is finished. Start a new run to keep going.' }, { status: 409 });
  }

  const outcome = await advanceDays(owned.account, body.days ?? 1);
  return Response.json({
    ok: true,
    currentDay: outcome.account.currentDay,
    state: outcome.account.state,
    results: outcome.results,
  });
}
