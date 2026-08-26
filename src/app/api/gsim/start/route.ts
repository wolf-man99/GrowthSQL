import { buildSandbox } from '@/lib/gsim/scenarios/sandbox';
import { createGAccount, loadGSandbox } from '@/lib/gsim/account';
import { requireGoogleRunAccess } from '@/lib/gsim/guard';
import type { VerticalId } from '@/lib/gsim/verticals';

export const runtime = 'nodejs';

/**
 * Opens a free-play account in a chosen market.
 *
 * The vertical is picked once, at the start, and never changes — which is the
 * honest shape, because the whole point of offering two is that they are different
 * businesses. Switching mid-run would leave a keyword list built for shoes bidding
 * on accounting software.
 */
export async function POST(req: Request) {
  const auth = await requireGoogleRunAccess();
  if (!auth.ok) return auth.response;

  let body: { vertical?: string; restart?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const vertical: VerticalId = body.vertical === 'b2b' ? 'b2b' : 'd2c';

  const existing = await loadGSandbox(auth.profileId);
  if (existing && !body.restart) {
    return Response.json({ ok: true, accountId: existing.id, resumed: true });
  }

  const state = buildSandbox(vertical);
  const account = await createGAccount({ profileId: auth.profileId, state });
  return Response.json({ ok: true, accountId: account.id, resumed: false });
}
