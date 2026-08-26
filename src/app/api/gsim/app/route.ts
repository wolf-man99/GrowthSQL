import { prisma } from '@/lib/db';
import { requireGoogleRunAccess, requireOwnedGAccount } from '@/lib/gsim/guard';
import type { AppSettings } from '@/lib/gsim/engine/app';
import type { GState } from '@/lib/gsim/engine/types';

export const runtime = 'nodejs';

/**
 * Changes an App campaign's goal, target or assets.
 *
 * Separate from /api/gsim/edit because App settings are not one of `GEdit`'s cases.
 * An App campaign's levers live on a sub-object that the generic edit vocabulary
 * does not reach, and widening that vocabulary to cover one campaign type would
 * make every other edit path carry fields it has no use for.
 *
 * Validated field by field rather than accepted wholesale. These numbers feed
 * delivery directly — a target of 1e308 or a negative asset count would produce an
 * account of NaNs that persists and compounds on every subsequent day.
 */
export async function POST(req: Request) {
  const auth = await requireGoogleRunAccess();
  if (!auth.ok) return auth.response;

  let body: { accountId?: string; campaignId?: string; app?: unknown };
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

  const state = owned.account.state;
  const campaign = state.campaigns.find((c) => c.id === body.campaignId);
  if (!campaign || campaign.type !== 'app' || !campaign.app) {
    return Response.json({ error: 'App campaign not found.' }, { status: 404 });
  }

  const parsed = parseAppSettings(body.app, campaign.app);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  // Changing the goal is a change of strategy, and Smart Bidding re-learns after
  // one exactly as it does on a Search campaign. Recording it here is what keeps
  // that cost real rather than a claim a lesson makes.
  const goalChanged = parsed.app.goal !== campaign.app.goal;

  const next: GState = structuredClone(state);
  const target = next.campaigns.find((c) => c.id === campaign.id)!;
  target.app = parsed.app;
  if (goalChanged) {
    target.runtime.strategyChangedDay = owned.account.currentDay;
    target.runtime.trailingConversions = [];
  }

  await prisma.simAccount.update({
    where: { id: owned.account.id },
    data: { state: next as unknown as object },
  });

  return Response.json({
    ok: true,
    state: next,
    note: goalChanged
      ? `Now optimising for ${LABEL[parsed.app.goal]}. The mix of inventory will change over the next few days, and so will every reported cost.`
      : 'Saved.',
  });
}

const LABEL: Record<AppSettings['goal'], string> = {
  installs: 'install volume',
  in_app_action: 'the in-app action',
  roas: 'return on ad spend',
};

const GOALS: AppSettings['goal'][] = ['installs', 'in_app_action', 'roas'];

function parseAppSettings(
  input: unknown,
  current: AppSettings,
): { ok: true; app: AppSettings } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'App settings must be an object.' };
  const a = input as Record<string, unknown>;

  const goal = GOALS.includes(a.goal as AppSettings['goal']) ? (a.goal as AppSettings['goal']) : null;
  if (!goal) return { ok: false, error: 'Unknown goal.' };

  const assets = a.assets as Record<string, unknown> | undefined;
  const asset = (v: unknown, fallback: number) => {
    if (v === undefined) return fallback;
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 50 ? Math.round(v) : null;
  };
  const headlines = asset(assets?.headlines, current.assets.headlines);
  const descriptions = asset(assets?.descriptions, current.assets.descriptions);
  const images = asset(assets?.images, current.assets.images);
  const videos = asset(assets?.videos, current.assets.videos);
  if (headlines === null || descriptions === null || images === null || videos === null) {
    return { ok: false, error: 'Asset counts must be whole numbers between 0 and 50.' };
  }

  const money = (v: unknown) =>
    (v === undefined ? undefined
      : typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1_000_000 ? v : null);
  const targetCpi = money(a.targetCpi);
  const targetEventCpa = money(a.targetEventCpa);
  if (targetCpi === null || targetEventCpa === null) {
    return { ok: false, error: 'Targets must be between ₹1 and ₹10,00,000.' };
  }
  const targetRoas = a.targetRoas === undefined ? undefined
    : typeof a.targetRoas === 'number' && Number.isFinite(a.targetRoas)
      && a.targetRoas > 0 && a.targetRoas <= 100 ? a.targetRoas : null;
  if (targetRoas === null) return { ok: false, error: 'Target ROAS is out of range.' };

  // The economics of the app itself are fixed by the scenario and are not the
  // learner's to edit: letting a request set what a conversion is worth would let
  // it declare itself profitable.
  return {
    ok: true,
    app: {
      goal,
      assets: { headlines, descriptions, images, videos },
      targetCpi, targetEventCpa, targetRoas,
      eventName: current.eventName,
      eventRate: current.eventRate,
      eventValue: current.eventValue,
    },
  };
}
