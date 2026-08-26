/**
 * Which searches a keyword is allowed to enter the auction for.
 *
 * This is the heart of the whole simulator. Everything the Google Ads course
 * teaches about match types, search terms and negative keywords is downstream of
 * this one function, and if it is wrong the lessons are wrong in a way no amount
 * of good UI can rescue.
 *
 * Matching is on **concepts, not strings**. A query carries a set of ideas it
 * contains ("running-shoes", "purchase-intent", "waterproof"), and a keyword
 * carries its own. That is what lets broad match reach a query sharing none of
 * its words — the behaviour every buyer has to learn to see coming, and one that
 * substring matching cannot produce at all.
 *
 * The three match types differ only in how much conceptual distance they tolerate:
 *
 *   exact   the same idea. Close variants pass; a different idea does not.
 *   phrase  the keyword's idea must be *contained* in the query's.
 *   broad   partial overlap is enough, and relevance degrades with distance.
 *
 * That last clause is where the money goes. Broad match does not just match more;
 * it matches *worse*, and the engine has to model both halves or the lesson
 * becomes "broad match is fine".
 */

import type { GKeyword, GNegative, SearchQuery } from './types';
import { GMODEL } from './types';

/** Concept tokens for a keyword's text. Keywords are authored with plain text, so
 *  their concepts are derived the same way a query's are: by tokenising and
 *  dropping the filler that carries no commercial meaning. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'to', 'of', 'in', 'on', 'and', 'or', 'my', 'me', 'i',
  'is', 'are', 'was', 'best', 'top',
]);

export function conceptsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/** Jaccard-ish overlap, biased toward how much of the *keyword* is present in the
 *  query. A two-word keyword fully contained in a six-word query is a strong
 *  match; the reverse is not. */
export function overlap(keywordConcepts: string[], queryConcepts: string[]): number {
  if (keywordConcepts.length === 0) return 0;
  const q = new Set(queryConcepts);
  let hits = 0;
  for (const c of keywordConcepts) if (q.has(c)) hits++;
  const contained = hits / keywordConcepts.length;
  // A small penalty for the query carrying a lot the keyword does not, which is
  // how "running shoes" matching "running shoes repair near me chennai" ends up
  // weaker than matching "buy running shoes".
  const extra = Math.max(0, queryConcepts.length - keywordConcepts.length);
  return contained * (1 - Math.min(0.35, extra * 0.06));
}

export interface MatchResult {
  matched: boolean;
  /** 0..1. How relevant this query actually is to the keyword's intent. Feeds ad
   *  relevance and therefore Quality Score, and dampens conversion rate: a query
   *  matched at the edge of broad converts far worse than the keyword's core. */
  relevance: number;
}

const NO_MATCH: MatchResult = { matched: false, relevance: 0 };

/**
 * Does this keyword match this query, and how well?
 *
 * Exact is not string equality, and has not been since 2018 — it matches close
 * variants, which is why an all-exact account still has to read its search terms
 * report. That is modelled here as a high overlap threshold rather than identity.
 */
export function matchKeyword(keyword: GKeyword, query: SearchQuery): MatchResult {
  const kc = conceptsOf(keyword.text);
  const ov = overlap(kc, query.concepts);
  // Broad match is allowed to read the query's adjacent ideas as well as its
  // words. Exact and phrase are not, which is the entire difference between them.
  const broadOv = query.related?.length
    ? Math.max(ov, overlap(kc, [...query.concepts, ...query.related]))
    : ov;

  switch (keyword.match) {
    case 'exact': {
      // The same idea, allowing for plurals and reordering, which `conceptsOf`
      // already normalises away. Anything materially different is out.
      if (ov < 0.92) return NO_MATCH;
      // A query carrying extra commercial modifiers is still the same idea, so
      // relevance stays near the top.
      return { matched: true, relevance: Math.min(1, 0.9 + ov * 0.1) };
    }
    case 'phrase': {
      if (ov < GMODEL.phraseConceptOverlap) return NO_MATCH;
      // Relevance tracks how much of the query is the keyword's own idea rather
      // than something bolted on.
      return { matched: true, relevance: 0.62 + ov * 0.34 };
    }
    case 'broad': {
      if (broadOv < GMODEL.broadConceptOverlap) return NO_MATCH;
      // The important line in the file. Broad match reaches further, and what it
      // finds out there is worse in proportion to how far it reached. A query
      // matched at the threshold is barely related; one matched at full overlap
      // is as good as phrase.
      //
      // Distance is measured from the *literal* overlap, not the adjacent one: a
      // query reached only through its related ideas is, by construction, at the
      // edge of the keyword's reach, and is priced and converted accordingly.
      const distance = 1 - ov;
      const relevance = Math.max(0.12, 1 - distance * (1 / GMODEL.broadRelevanceDecay) * 0.62);
      return { matched: true, relevance };
    }
  }
}

/**
 * Does a negative keyword block this query?
 *
 * Negatives are the asymmetry that catches everyone once: **a negative does not
 * expand to synonyms or close variants**. Negate "cheap" and "affordable" still
 * runs. That is modelled by matching a negative's concepts literally against the
 * query's, with no overlap tolerance for broad and no close-variant allowance for
 * exact.
 */
export function negativeBlocks(negative: GNegative, query: SearchQuery): boolean {
  const nc = conceptsOf(negative.text);
  if (nc.length === 0) return false;
  const q = new Set(query.concepts);

  switch (negative.match) {
    case 'broad':
      // Every concept in the negative appears somewhere in the query, in any
      // order. Literal only: no synonyms.
      return nc.every((c) => q.has(c));
    case 'phrase':
      // The concepts must appear in order within the query.
      return containsInOrder(query.concepts, nc);
    case 'exact':
      // Only the search that *is* the negative.
      return nc.length === query.concepts.length && nc.every((c) => q.has(c));
  }
}

function containsInOrder(haystack: string[], needle: string[]): boolean {
  let i = 0;
  for (const h of haystack) {
    if (h === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

/** The negatives that apply to a given keyword, given the levels they sit at. */
export function negativesFor(
  negatives: GNegative[],
  campaignId: string,
  adGroupId: string,
): GNegative[] {
  return negatives.filter((n) =>
    n.level === 'account'
    || (n.level === 'campaign' && n.ownerId === campaignId)
    || (n.level === 'adgroup' && n.ownerId === adGroupId));
}

export interface Eligibility {
  keyword: GKeyword;
  relevance: number;
}

/**
 * Every keyword eligible to bid on one query, best match first.
 *
 * Google runs one ad per advertiser per auction, so when several of your own
 * keywords match the same search, only one enters. Google picks the most specific
 * — exact over phrase over broad, then the higher Ad Rank. Modelled here as
 * "highest relevance wins", which produces the same ordering and is what makes a
 * well-structured account's exact keywords shield its broad ones.
 */
export function eligibleKeywords(
  query: SearchQuery,
  keywords: GKeyword[],
  adGroupOf: (keywordId: string) => { adGroupId: string; campaignId: string } | undefined,
  negatives: GNegative[],
): Eligibility[] {
  const out: Eligibility[] = [];

  for (const keyword of keywords) {
    if (keyword.status !== 'active') continue;
    const owner = adGroupOf(keyword.id);
    if (!owner) continue;

    const m = matchKeyword(keyword, query);
    if (!m.matched) continue;

    const blocked = negativesFor(negatives, owner.campaignId, owner.adGroupId)
      .some((n) => negativeBlocks(n, query));
    if (blocked) continue;

    out.push({ keyword, relevance: m.relevance });
  }

  return out.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Which single keyword of an advertiser's actually enters the auction.
 *
 * One per campaign, because two campaigns in the same account genuinely do
 * compete with each other on Google — that is what makes a Search campaign and a
 * Performance Max campaign fighting over the same brand query a real and
 * expensive phenomenon rather than a modelling artefact.
 */
export function winnerPerCampaign(
  eligible: Eligibility[],
  campaignOf: (keywordId: string) => string | undefined,
): Map<string, Eligibility> {
  const best = new Map<string, Eligibility>();
  for (const e of eligible) {
    const campaignId = campaignOf(e.keyword.id);
    if (!campaignId) continue;
    if (!best.has(campaignId)) best.set(campaignId, e);
  }
  return best;
}
