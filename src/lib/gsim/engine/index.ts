/**
 * The Google Ads simulation engine.
 *
 * One entry point so scenarios, missions, API routes and the calibration gate all
 * import the same surface and nothing reaches around it.
 */

export * from './types';
export { conceptsOf, overlap, matchKeyword, negativeBlocks, negativesFor, eligibleKeywords, winnerPerCampaign } from './matching';
export type { MatchResult, Eligibility } from './matching';
export {
  adRelevance, expectedCtr, computeQuality, clickValue, marketCpc,
  adRank, drawRivals, resolveAuction, runAuction, ctrForPosition,
} from './auction';
export type { Quality, QualityInputs, AuctionInputs, AuctionOutcome, ResolveInputs } from './auction';
export {
  APP_CHANNELS, APP_CHANNEL_BY_ID, APP_GOAL_LABEL, tickApp,
  costPerInstall, costPerEvent, activationRate,
} from './app';
export type { AppChannel, AppAssets, AppBidGoal, AppSettings, AppTickInputs } from './app';
export { tick, run } from './delivery';
export type { GTickOptions } from './delivery';
export { mulberry32, stringSeed, streamFor, jitter } from './rng';
export type { Rng } from './rng';
