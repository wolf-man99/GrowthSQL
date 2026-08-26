/**
 * The gate every Google Ads simulator route passes through, and the validator
 * that decides what an edit is allowed to be.
 *
 * The pages already check entitlement before rendering. Checking again here is not
 * redundant: pages guard what a learner *sees*, routes guard what they can *do*,
 * and the second is the half that matters when somebody calls the API directly
 * instead of clicking through the interface.
 *
 * The validator matters for a different reason. `GEdit` is a discriminated union
 * that the engine trusts completely — `applyEdit` will set a budget to whatever
 * number it is handed. A budget of 1e308 would produce an account of NaNs that
 * persists, and every subsequent tick would compound it. So nothing reaches the
 * engine until it has been checked here, field by field.
 */

import { getProfileId } from '@/lib/auth/server';
import { isRunUnlocked } from '@/lib/progress/gating';
import { loadGAccount, type GAccountRecord } from './account';
import type { GEdit } from './state';
import type { GBidStrategy, GStatus, MatchType } from './engine/types';

export type GuardFailure = { ok: false; response: Response };

export async function requireGoogleRunAccess(): Promise<GuardFailure | { ok: true; profileId: string }> {
  const profileId = await getProfileId();
  if (!profileId) {
    return { ok: false, response: Response.json({ error: 'Not signed in.' }, { status: 401 }) };
  }
  if (!(await isRunUnlocked(profileId, 'google-ads'))) {
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
 * `loadGAccount` already scopes its query by profileId, so a mismatched id returns
 * null rather than somebody else's account. Deliberately a 404 and not a 403:
 * confirming that a guessed id names a real account is itself information.
 */
export async function requireOwnedGAccount(
  accountId: unknown,
  profileId: string,
): Promise<GuardFailure | { ok: true; account: GAccountRecord }> {
  if (typeof accountId !== 'string' || accountId.length === 0) {
    return { ok: false, response: Response.json({ error: 'accountId is required.' }, { status: 400 }) };
  }
  const account = await loadGAccount(accountId, profileId);
  if (!account) {
    return { ok: false, response: Response.json({ error: 'Account not found.' }, { status: 404 }) };
  }
  return { ok: true, account };
}

// ───────────────────────────────────────────────────────────── validation ──

const STATUSES: GStatus[] = ['active', 'paused', 'removed'];
const MATCHES: MatchType[] = ['exact', 'phrase', 'broad'];
const STRATEGIES: GBidStrategy[] = [
  'manual_cpc', 'maximise_clicks', 'maximise_conversions', 'target_cpa', 'target_roas',
];

/** Rupees. A budget above this is not a scenario, it is an attempt to make the
 *  engine simulate a hundred million searches inside one request. */
const MAX_BUDGET = 5_000_000;
const MAX_BID = 100_000;

function str(v: unknown, max = 120): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;
}

function num(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

/**
 * Turns an untrusted request body into a `GEdit`, or explains why it is not one.
 *
 * Whitelist by design: an unknown `kind` is rejected rather than passed through,
 * so adding an edit type to the engine does not silently expose it over HTTP
 * before anybody has thought about what it should be allowed to do.
 */
export function parseGEdit(input: unknown): { ok: true; edit: GEdit } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'Edit must be an object.' };
  const e = input as Record<string, unknown>;
  const bad = (why: string) => ({ ok: false as const, error: why });

  const id = str(e.id);
  const status = STATUSES.includes(e.status as GStatus) ? (e.status as GStatus) : null;

  switch (e.kind) {
    case 'campaign_status':
    case 'adgroup_status':
    case 'keyword_status': {
      if (!id) return bad('id is required.');
      if (!status) return bad('status must be active, paused or removed.');
      return { ok: true, edit: { kind: e.kind, id, status } as GEdit };
    }
    case 'campaign_budget': {
      const dailyBudget = num(e.dailyBudget, 1, MAX_BUDGET);
      if (!id) return bad('id is required.');
      if (dailyBudget === null) return bad(`Budget must be between ₹1 and ₹${MAX_BUDGET.toLocaleString('en-IN')}.`);
      return { ok: true, edit: { kind: 'campaign_budget', id, dailyBudget } };
    }
    case 'campaign_bid_strategy': {
      if (!id) return bad('id is required.');
      const bidStrategy = STRATEGIES.includes(e.bidStrategy as GBidStrategy)
        ? (e.bidStrategy as GBidStrategy) : null;
      if (!bidStrategy) return bad('Unknown bid strategy.');
      const targetCpa = e.targetCpa === undefined ? undefined : num(e.targetCpa, 1, MAX_BUDGET);
      const targetRoas = e.targetRoas === undefined ? undefined : num(e.targetRoas, 0.1, 100);
      if (targetCpa === null) return bad('Target CPA is out of range.');
      if (targetRoas === null) return bad('Target ROAS is out of range.');
      return { ok: true, edit: { kind: 'campaign_bid_strategy', id, bidStrategy, targetCpa, targetRoas } };
    }
    case 'campaign_pmax_reach': {
      const pmaxReach = num(e.pmaxReach, 0, 2);
      if (!id) return bad('id is required.');
      if (pmaxReach === null) return bad('Reach must be between 0 and 2.');
      return { ok: true, edit: { kind: 'campaign_pmax_reach', id, pmaxReach } };
    }
    case 'adgroup_cpc': {
      const defaultCpc = num(e.defaultCpc, 1, MAX_BID);
      if (!id) return bad('id is required.');
      if (defaultCpc === null) return bad('Default CPC is out of range.');
      return { ok: true, edit: { kind: 'adgroup_cpc', id, defaultCpc } };
    }
    case 'adgroup_landing_page': {
      const landingPageQuality = num(e.landingPageQuality, 0.4, 1.3);
      if (!id) return bad('id is required.');
      if (landingPageQuality === null) return bad('Landing page quality is out of range.');
      return { ok: true, edit: { kind: 'adgroup_landing_page', id, landingPageQuality } };
    }
    case 'keyword_bid': {
      const maxCpc = num(e.maxCpc, 1, MAX_BID);
      if (!id) return bad('id is required.');
      if (maxCpc === null) return bad('Bid is out of range.');
      return { ok: true, edit: { kind: 'keyword_bid', id, maxCpc } };
    }
    case 'keyword_match': {
      if (!id) return bad('id is required.');
      const match = MATCHES.includes(e.match as MatchType) ? (e.match as MatchType) : null;
      if (!match) return bad('Match type must be exact, phrase or broad.');
      return { ok: true, edit: { kind: 'keyword_match', id, match } };
    }
    case 'add_negative': {
      const n = e.negative as Record<string, unknown> | undefined;
      if (!n) return bad('negative is required.');
      const text = str(n.text, 80);
      if (!text) return bad('Negative keyword text is required.');
      const level = ['account', 'campaign', 'adgroup'].includes(n.level as string)
        ? (n.level as 'account' | 'campaign' | 'adgroup') : null;
      if (!level) return bad('Level must be account, campaign or adgroup.');
      const match = MATCHES.includes(n.match as MatchType) ? (n.match as MatchType) : 'phrase';
      const ownerId = n.ownerId === undefined ? undefined : str(n.ownerId);
      if (level !== 'account' && !ownerId) return bad('A campaign or ad group negative needs an owner.');
      return {
        ok: true,
        edit: {
          kind: 'add_negative',
          negative: { id: `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, level, ownerId: ownerId ?? undefined, text, match },
        },
      };
    }
    case 'remove_negative': {
      if (!id) return bad('id is required.');
      return { ok: true, edit: { kind: 'remove_negative', id } };
    }
    default:
      // Creation edits (add_campaign, add_adgroup, add_keyword, add_ad) carry whole
      // entities including their runtime counters, so they are built server-side
      // from a narrow request rather than accepted wholesale. See /api/gsim/create.
      return bad('Unsupported edit.');
  }
}
