import { createAccount, loadSandbox } from '@/lib/simulator/account';
import { requireRunAccess } from '@/lib/simulator/guard';
import { buildSandboxAccount } from '@/lib/simulator/scenarios/sandbox';

export const runtime = 'nodejs';

/**
 * Opens the learner's sandbox account, creating it on first visit.
 *
 * Idempotent by design: a learner who reloads, or opens Run in a second tab, must
 * land back in the account they were already running rather than silently starting
 * a fresh one and losing a fortnight of decisions.
 */
export async function POST() {
  const auth = await requireRunAccess();
  if (!auth.ok) return auth.response;

  const existing = await loadSandbox(auth.profileId, 'meta-ads');
  if (existing) {
    return Response.json({ ok: true, created: false, accountId: existing.id, state: existing.state });
  }

  const account = await createAccount({
    profileId: auth.profileId,
    courseId: 'meta-ads',
    state: buildSandboxAccount(),
  });
  return Response.json({ ok: true, created: true, accountId: account.id, state: account.state });
}
