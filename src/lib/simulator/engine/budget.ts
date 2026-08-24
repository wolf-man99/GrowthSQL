/**
 * Where the money goes each day: ABO, CBO, and pacing.
 *
 * Under ABO the learner decides the split and every ad set is guaranteed its
 * budget, which is what makes a fair test possible. Under CBO Meta decides, and it
 * decides greedily, concentrating spend on whatever is winning early. Both are
 * modelled honestly here, because module 4.1's lesson ("test with ABO, scale with
 * CBO") is only convincing if putting five untested audiences in a CBO campaign
 * really does starve four of them.
 */

import { MODEL, type SimAdSet, type SimCampaign } from './types';
import { jitter, type Rng } from './rng';

/** Efficiency score used to weight CBO allocation: purchases per rupee so far. */
function efficiency(adSet: SimAdSet): number {
  const { spend, purchases } = adSet.runtime;
  if (spend <= 0) return 0;
  return purchases / spend;
}

/**
 * Splits a CBO campaign's daily budget across its live ad sets.
 *
 * Weighting is efficiency raised to `cboConcentration`, so a modest early lead
 * compounds into a dominant share of spend. A floor share keeps brand-new ad sets
 * from being zeroed out entirely before they have any history at all, matching
 * Meta's behaviour of giving a new ad set a brief look-in.
 *
 * Before anyone has spent, weights fall back to equal-with-noise: the front-runner
 * is genuinely arbitrary on day one, which is precisely why CBO is the wrong tool
 * for a fair test.
 */
export function allocateCbo(
  campaignBudget: number,
  adSets: SimAdSet[],
  rng: Rng,
): Map<string, number> {
  const out = new Map<string, number>();
  if (adSets.length === 0 || campaignBudget <= 0) return out;

  const scores = adSets.map((a) => {
    const e = efficiency(a);
    // No history yet: an arbitrary near-equal draw, not a considered judgement.
    const merit = e <= 0 ? 0.5 * jitter(rng, 0.2) : (e * 1000) ** MODEL.cboConcentration;
    // Inertia. An ad set already receiving budget keeps receiving it, so whichever
    // one happened to look good first compounds into the front-runner. This is why
    // five *identical* untested audiences still end up wildly unevenly funded.
    const momentum = (1 / adSets.length + a.runtime.cboShare * MODEL.cboMomentum) ** 1.35;
    return merit * momentum;
  });

  const total = scores.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const even = campaignBudget / adSets.length;
    for (const a of adSets) out.set(a.id, even);
    return out;
  }

  // Apply the floor first, then distribute what remains by weight, so the floor is
  // a genuine guarantee rather than something the normalisation quietly erodes.
  const floor = campaignBudget * MODEL.cboMinShare;
  const guaranteed = Math.min(floor * adSets.length, campaignBudget * 0.5);
  const discretionary = campaignBudget - guaranteed;
  const perSetFloor = guaranteed / adSets.length;

  adSets.forEach((a, idx) => {
    out.set(a.id, perSetFloor + discretionary * (scores[idx] / total));
  });
  return out;
}

/**
 * Today's budget for every live ad set in a campaign.
 *
 * ABO reads each ad set's own budget; CBO asks `allocateCbo` to divide the
 * campaign's. Either way the result is what delivery is allowed to spend before
 * pacing is applied.
 */
export function budgetsForCampaign(
  campaign: SimCampaign,
  liveAdSets: SimAdSet[],
  rng: Rng,
): Map<string, number> {
  if (campaign.budgetMode === 'cbo') {
    return allocateCbo(campaign.dailyBudget ?? 0, liveAdSets, rng);
  }
  const out = new Map<string, number>();
  for (const a of liveAdSets) out.set(a.id, a.dailyBudget ?? 0);
  return out;
}

/**
 * Actual spend against an allowed budget.
 *
 * Real ad sets rarely spend to the rupee, and one still finding its footing spends
 * less reliably than a settled one. Under a cost cap, delivery holds back further
 * rather than buy expensive impressions, which is the trade the strategy makes.
 */
export function paceSpend(
  budget: number,
  opts: { learningPenalty: boolean; costCapped: boolean },
  rng: Rng,
): number {
  if (budget <= 0) return 0;
  const span = MODEL.pacingCeiling - MODEL.pacingFloor;
  let pacing = MODEL.pacingFloor + rng() * span;
  if (opts.learningPenalty) pacing *= 0.9;
  if (opts.costCapped) pacing *= 0.88;
  return budget * pacing;
}
