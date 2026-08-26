import { applyGEdit } from '@/lib/gsim/account';
import { parseGEdit, requireGoogleRunAccess, requireOwnedGAccount } from '@/lib/gsim/guard';

export const runtime = 'nodejs';

/**
 * Applies one change to an account.
 *
 * Everything goes through `applyEdit`, which is where an edit's cost is decided:
 * changing a bid strategy or moving a target restarts a learning period, and the
 * response says so, so the interface can tell the learner what they just spent.
 */
export async function POST(req: Request) {
  const auth = await requireGoogleRunAccess();
  if (!auth.ok) return auth.response;

  let body: { accountId?: string; edit?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const owned = await requireOwnedGAccount(body.accountId, auth.profileId);
  if (!owned.ok) return owned.response;

  if (owned.account.status !== 'active') {
    return Response.json({ error: 'This account is finished.' }, { status: 409 });
  }

  const parsed = parseGEdit(body.edit);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const outcome = await applyGEdit(owned.account, parsed.edit);
  return Response.json({
    ok: true,
    state: outcome.account.state,
    resetLearning: outcome.resetLearning,
    note: outcome.note,
  });
}
