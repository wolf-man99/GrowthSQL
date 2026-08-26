'use client';

/**
 * The pieces every Google Ads table is built from.
 *
 * Two of them carry real teaching weight rather than being decoration:
 *
 * `QualityScore` shows the number and its three components, because the number on
 * its own is unactionable. A keyword scoring 4 tells you nothing; a keyword scoring
 * 4 with "Ad relevance: below average" tells you to rewrite the ad, and one scoring
 * 4 with "Landing page: below average" tells you the ad is fine and the page is not.
 *
 * `ImpressionShareBar` shows won, lost-to-rank and lost-to-budget as one bar. Those
 * three add up to every auction the keyword was eligible for, and seeing them as
 * parts of a whole is what turns "my impression share is 22%" from a statistic into
 * a decision: the missing 78% is either a bidding problem or a money problem, and
 * the bar says which.
 */

import type { ReactNode } from 'react';
import { absTopShare, impressionShare, inr, lostToBudgetShare, lostToRankShare, pct } from '@/lib/gsim/view';

export function Kpi({
  label, value, note, tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'good' | 'bad';
}) {
  const cls = tone === 'good' ? 'ga-kpi ga-kpi-good' : tone === 'bad' ? 'ga-kpi ga-kpi-bad' : 'ga-kpi';
  return (
    <div className={cls}>
      <div className="ga-kpi-l">{label}</div>
      <div className="ga-kpi-v">{value}</div>
      {note ? <div className="ga-kpi-note">{note}</div> : null}
    </div>
  );
}

const QS_COLOUR = (score: number) =>
  (score >= 7 ? 'var(--g-green)' : score >= 5 ? 'var(--g-amber)' : 'var(--g-red)');

const GRADE_LABEL: Record<string, string> = {
  above: 'Above average',
  average: 'Average',
  below: 'Below average',
};

export function QualityScore({
  score, detail,
}: {
  score: number;
  detail: { expectedCtr: string; adRelevance: string; landingPage: string };
}) {
  if (score <= 0) return <span style={{ color: 'var(--g-faint)' }}>—</span>;
  const title = [
    `Expected CTR: ${GRADE_LABEL[detail.expectedCtr] ?? detail.expectedCtr}`,
    `Ad relevance: ${GRADE_LABEL[detail.adRelevance] ?? detail.adRelevance}`,
    `Landing page: ${GRADE_LABEL[detail.landingPage] ?? detail.landingPage}`,
  ].join('\n');

  return (
    <span className="ga-qs" title={title}>
      <span className="ga-qs-bar">
        <span
          className="ga-qs-fill"
          style={{ width: `${score * 10}%`, background: QS_COLOUR(score) }}
        />
      </span>
      {score}/10
    </span>
  );
}

/** Won, lost to rank, lost to budget — the whole of an eligible auction. */
export function ImpressionShareBar({
  row,
}: {
  row: { impressions: number; eligible: number; lostToRank: number; lostToBudget: number };
}) {
  if (row.eligible === 0) return <span style={{ color: 'var(--g-faint)' }}>—</span>;
  const won = impressionShare(row);
  const rank = lostToRankShare(row);
  const budget = lostToBudgetShare(row);

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      title={`Won ${pct(won, 1)} · Lost to rank ${pct(rank, 1)} · Lost to budget ${pct(budget, 1)}`}
    >
      <span className="ga-isbar">
        <span className="ga-is-won" style={{ width: `${won * 100}%` }} />
        <span className="ga-is-rank" style={{ width: `${rank * 100}%` }} />
        <span className="ga-is-budget" style={{ width: `${budget * 100}%` }} />
      </span>
      {pct(won, 0)}
    </span>
  );
}

/** Where on the page the ad landed, as Google reports it since it retired average
 *  position: how often above the organic results, and how often first. */
export function PositionShare({
  row,
}: {
  row: { impressions: number; topImpressions: number; absTopImpressions: number };
}) {
  if (row.impressions === 0) return <span style={{ color: 'var(--g-faint)' }}>—</span>;
  return (
    <span title={`Top of page ${pct(row.topImpressions / row.impressions, 1)} · Absolute top ${pct(absTopShare(row), 1)}`}>
      {pct(absTopShare(row), 0)}
    </span>
  );
}

const STATE_LABEL: Record<string, { label: string; dot: string }> = {
  eligible: { label: 'Eligible', dot: 'ga-dot-ok' },
  below_first_page: { label: 'Below first page bid', dot: 'ga-dot-warn' },
  rarely_shown_quality: { label: 'Rarely shown (low Quality Score)', dot: 'ga-dot-bad' },
  low_volume: { label: 'Low search volume', dot: 'ga-dot-off' },
  paused: { label: 'Paused', dot: 'ga-dot-off' },
};

export function KeywordState({ state }: { state: string }) {
  const s = STATE_LABEL[state] ?? { label: state, dot: 'ga-dot-off' };
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span className={`ga-dot ${s.dot}`} />
      <span style={{ fontSize: 11.5, color: 'var(--g-muted)' }}>{s.label}</span>
    </span>
  );
}

export function TypeChip({ type, label }: { type: string; label: string }) {
  const cls = type === 'search' ? 'ga-type-chip ga-type-search'
    : type === 'pmax' ? 'ga-type-chip ga-type-pmax'
      : type === 'app' ? 'ga-type-chip ga-type-app'
        : 'ga-type-chip';
  return <span className={cls}>{label}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="ga-empty">
      <div className="ga-empty-title">{title}</div>
      {children}
    </div>
  );
}

/** A cell the learner can click to change. Wrapping it in a button rather than
 *  making the whole row editable keeps the affordance where the change is. */
export function EditableCell({
  value, onClick, label,
}: {
  value: string;
  onClick: (anchor: DOMRect) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="ga-cell-edit"
      aria-label={label}
      onClick={(e) => onClick(e.currentTarget.getBoundingClientRect())}
    >
      {value}
    </button>
  );
}

export function Money({ value, decimals = 0 }: { value: number; decimals?: number }) {
  return <>{inr(value, decimals)}</>;
}
