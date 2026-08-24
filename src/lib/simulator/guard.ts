import { getProfileId } from '@/lib/auth/server';
import { isRunUnlocked } from '@/lib/progress/gating';
import { loadAccount, type SimAccountRecord } from './account';

/**
 * The gate every simulator API route passes through.
 *
 * Run sits behind both halves of the entitlement (every Learn lesson passed AND a
 * verified purchase), and the pages already check that before rendering. Checking
 * again here is not redundant: the pages guard what a learner *sees*, and these
 * routes guard what they can *do*, which is the half that matters when someone
 * calls the API directly rather than clicking through the UI.
 */

export type GuardFailure = { ok: false; response: Response };
export type GuardSuccess = { ok: true; profileId: string };

export async function requireRunAccess(courseId = 'meta-ads'): Promise<GuardFailure | GuardSuccess> {
  const profileId = await getProfileId();
  if (!profileId) {
    return { ok: false, response: Response.json({ error: 'Not signed in.' }, { status: 401 }) };
  }
  const unlocked = await isRunUnlocked(profileId, courseId);
  if (!unlocked) {
    return {
      ok: false,
      response: Response.json({ error: 'Run is not unlocked on this account.' }, { status: 403 }),
    };
  }
  return { ok: true, profileId };
}

/**
 * Resolves an account id to a record the caller actually owns.
 *
 * `loadAccount` already scopes its query by profileId, so a mismatched id returns
 * null rather than someone else's account; this turns that into the 404 the route
 * should send. Deliberately not a 403: telling an attacker they guessed a real
 * account id is itself information.
 */
export async function requireOwnedAccount(
  accountId: unknown,
  profileId: string,
): Promise<GuardFailure | { ok: true; account: SimAccountRecord }> {
  if (typeof accountId !== 'string' || accountId.length === 0) {
    return { ok: false, response: Response.json({ error: 'accountId is required.' }, { status: 400 }) };
  }
  const account = await loadAccount(accountId, profileId);
  if (!account) {
    return { ok: false, response: Response.json({ error: 'Account not found.' }, { status: 404 }) };
  }
  return { ok: true, account };
}
