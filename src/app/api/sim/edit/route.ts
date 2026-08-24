import { applyEditToAccount, previewEditReset } from '@/lib/simulator/account';
import { requireOwnedAccount, requireRunAccess } from '@/lib/simulator/guard';
import type { SimEdit } from '@/lib/simulator/engine';

export const runtime = 'nodejs';

/**
 * Applies one edit to a simulated account, or previews what it would cost.
 *
 * `preview: true` returns which ad sets the edit would knock back into the
 * learning phase without changing anything, so the UI can ask "this restarts
 * learning on 2 ad sets, continue?" rather than surprising the learner after the
 * fact. Teaching the rule is the point; springing it is not.
 */
export async function POST(req: Request) {
  const auth = await requireRunAccess();
  if (!auth.ok) return auth.response;

  let body: { accountId?: string; edit?: SimEdit; preview?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body.edit || typeof body.edit !== 'object' || !('kind' in body.edit)) {
    return Response.json({ error: 'edit is required.' }, { status: 400 });
  }

  const owned = await requireOwnedAccount(body.accountId, auth.profileId);
  if (!owned.ok) return owned.response;

  if (body.preview) {
    return Response.json({ ok: true, resetAdSetIds: previewEditReset(owned.account, body.edit) });
  }

  if (owned.account.status !== 'active') {
    return Response.json({ error: 'This account is finished and can no longer be edited.' }, { status: 409 });
  }

  const outcome = await applyEditToAccount(owned.account, body.edit);
  if (outcome.error) return Response.json({ error: outcome.error }, { status: 400 });

  return Response.json({
    ok: true,
    state: outcome.account?.state,
    resetAdSetIds: outcome.resetAdSetIds,
  });
}
