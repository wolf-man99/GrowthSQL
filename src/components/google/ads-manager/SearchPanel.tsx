'use client';

/**
 * A Search campaign's workspace.
 *
 * Four tabs, in the order a buyer actually uses them: what you asked for, what you
 * got, what you said, and what you refused. The second is the one the course is
 * built around — a learner who never opens the search terms report cannot find a
 * single one of the problems in the starting account, because none of them are
 * visible anywhere else.
 *
 * The one interaction here that carries real weight is "Add as negative" on a
 * search term row. It is one click, and it is the click the whole Module 2 exists
 * to teach: you find the query that took ₹4,000 and returned nothing, and you stop
 * paying for it. Making the learner navigate to a separate negatives screen and
 * retype the term would be more faithful to the real interface and much worse at
 * teaching, because the connection between the report and the fix is the lesson.
 */

import { useMemo, useState } from 'react';
import {
  cpa, cpc, ctr, cvr, inr, pct, count, roas,
  type KeywordRow, type TermRow,
} from '@/lib/gsim/view';
import type { GState } from '@/lib/gsim/engine/types';
import {
  Empty, ImpressionShareBar, KeywordState, PositionShare, QualityScore,
} from './shared';

export type SearchTab = 'keywords' | 'terms' | 'ads' | 'negatives';

export const SEARCH_TABS: { id: SearchTab; label: string }[] = [
  { id: 'keywords', label: 'Keywords' },
  { id: 'terms', label: 'Search terms' },
  { id: 'ads', label: 'Ads' },
  { id: 'negatives', label: 'Negative keywords' },
];

interface Props {
  tab: SearchTab;
  state: GState;
  campaignId: string;
  keywords: KeywordRow[];
  terms: TermRow[];
  busy: boolean;
  onEditBid: (row: KeywordRow, anchor: DOMRect) => void;
  onToggleKeyword: (row: KeywordRow) => void;
  onAddNegative: (text: string, campaignId: string) => void;
  onRemoveNegative: (id: string) => void;
}

export function SearchPanel(props: Props) {
  switch (props.tab) {
    case 'keywords': return <KeywordsTab {...props} />;
    case 'terms': return <TermsTab {...props} />;
    case 'ads': return <AdsTab {...props} />;
    case 'negatives': return <NegativesTab {...props} />;
  }
}

// ─────────────────────────────────────────────────────────────── keywords ──

function KeywordsTab({ keywords, busy, onEditBid, onToggleKeyword }: Props) {
  if (keywords.length === 0) {
    return <Empty title="No keywords in this campaign" >Add keywords to start entering auctions.</Empty>;
  }

  const totals = keywords.reduce((a, k) => ({
    cost: a.cost + k.cost, clicks: a.clicks + k.clicks, impressions: a.impressions + k.impressions,
    conversions: a.conversions + k.conversions, convValue: a.convValue + k.convValue,
  }), { cost: 0, clicks: 0, impressions: 0, conversions: 0, convValue: 0 });

  return (
    <>
      <div className="ga-note">
        <b>Search impression share</b> is the three-colour bar: blue is auctions you won,
        amber is auctions you lost on Ad Rank, red is auctions you skipped because the
        campaign was out of budget. The three add up to every auction each keyword was
        eligible for. Which colour dominates decides what to fix — amber is a bidding or
        quality problem, red is a money problem, and they have different answers.
      </div>
      <div className="ga-tablewrap">
        <table className="ga-table">
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              <th>Keyword</th>
              <th>Status</th>
              <th className="num">Max CPC</th>
              <th>Quality Score</th>
              <th className="num">Impr.</th>
              <th className="num">Clicks</th>
              <th className="num">CTR</th>
              <th className="num">Avg. CPC</th>
              <th className="num">Cost</th>
              <th className="num">Conv.</th>
              <th className="num">Cost / conv.</th>
              <th>Search impr. share</th>
              <th className="num">Abs. top</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((k) => (
              <tr key={k.id} className={k.status !== 'active' ? 'ga-row-paused' : undefined}>
                <td>
                  <button
                    type="button"
                    className="ga-linky"
                    disabled={busy}
                    title={k.status === 'active' ? 'Pause keyword' : 'Enable keyword'}
                    aria-label={k.status === 'active' ? `Pause ${k.text}` : `Enable ${k.text}`}
                    onClick={() => onToggleKeyword(k)}
                  >
                    <span className={`ga-dot ${k.status === 'active' ? 'ga-dot-ok' : 'ga-dot-off'}`} />
                  </button>
                </td>
                <td>
                  <span className="ga-name ga-kw">{k.display}</span>
                  <span className="ga-sub">{k.adGroupName}</span>
                </td>
                <td><KeywordState state={k.status === 'active' ? k.state : 'paused'} /></td>
                <td className="num">
                  <button
                    type="button"
                    className="ga-cell-edit"
                    disabled={busy}
                    aria-label={`Edit max CPC for ${k.text}`}
                    onClick={(e) => onEditBid(k, e.currentTarget.getBoundingClientRect())}
                  >
                    {k.maxCpc ? inr(k.maxCpc) : '—'}
                  </button>
                </td>
                <td><QualityScore score={k.qualityScore} detail={k.qualityDetail} /></td>
                <td className="num">{count(k.impressions)}</td>
                <td className="num">{count(k.clicks)}</td>
                <td className="num">{pct(ctr(k))}</td>
                <td className="num">{inr(cpc(k))}</td>
                <td className="num">{inr(k.cost)}</td>
                <td className="num">{count(k.conversions)}</td>
                <td className="num">{k.conversions > 0 ? inr(cpa(k)) : '—'}</td>
                <td><ImpressionShareBar row={k} /></td>
                <td className="num"><PositionShare row={k} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Total: {keywords.length} keywords</td>
              <td className="num">{count(totals.impressions)}</td>
              <td className="num">{count(totals.clicks)}</td>
              <td className="num">{pct(ctr(totals))}</td>
              <td className="num">{inr(cpc(totals))}</td>
              <td className="num">{inr(totals.cost)}</td>
              <td className="num">{count(totals.conversions)}</td>
              <td className="num">{totals.conversions > 0 ? inr(cpa(totals)) : '—'}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────── search terms ──

type TermFilter = 'all' | 'nonconverting' | 'expensive';

function TermsTab({ terms, state, campaignId, busy, onAddNegative }: Props) {
  const [filter, setFilter] = useState<TermFilter>('all');

  const negatedTexts = useMemo(
    () => new Set(state.negatives.map((n) => n.text.toLowerCase())),
    [state.negatives],
  );

  const shown = useMemo(() => {
    if (filter === 'nonconverting') return terms.filter((t) => t.conversions === 0 && t.cost > 0);
    if (filter === 'expensive') return [...terms].sort((a, b) => b.cost - a.cost).slice(0, 25);
    return terms;
  }, [terms, filter]);

  const wasted = terms.filter((t) => t.conversions === 0).reduce((n, t) => n + t.cost, 0);
  const total = terms.reduce((n, t) => n + t.cost, 0);

  if (terms.length === 0) {
    return (
      <Empty title="No search terms yet">
        Advance a few days and this fills with the searches your keywords actually matched.
      </Empty>
    );
  }

  return (
    <>
      <div className={wasted / Math.max(1, total) > 0.35 ? 'ga-note ga-note-red' : 'ga-note'}>
        <b>{inr(wasted)}</b> of <b>{inr(total)}</b> ({pct(wasted / Math.max(1, total), 0)}) went to
        searches that produced no conversions. These are the searches your keywords
        matched — not the keywords you added. Every one of them is a decision you have
        not made yet.
      </div>

      <div className="ga-chips">
        {([
          ['all', `All terms (${terms.length})`],
          ['nonconverting', `No conversions (${terms.filter((t) => t.conversions === 0 && t.cost > 0).length})`],
          ['expensive', 'Top 25 by cost'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? 'ga-chip ga-chip-on' : 'ga-chip'}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ga-tablewrap">
        <table className="ga-table">
          <thead>
            <tr>
              <th>Search term</th>
              <th>Matched keyword</th>
              <th className="num">Impr.</th>
              <th className="num">Clicks</th>
              <th className="num">Cost</th>
              <th className="num">Conv.</th>
              <th className="num">Cost / conv.</th>
              <th className="num">Conv. rate</th>
              <th style={{ width: 130 }} />
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => {
              const negated = negatedTexts.has(t.text.toLowerCase());
              return (
                <tr key={`${t.queryId}|${t.keywordId}`}>
                  <td>
                    <span className="ga-name">{t.text}</span>
                    {t.conversions === 0 && t.cost > 0 ? (
                      <span className="ga-sub" style={{ color: 'var(--g-red)' }}>
                        {inr(t.cost)} spent, nothing back
                      </span>
                    ) : null}
                  </td>
                  <td style={{ color: 'var(--g-muted)' }}>{t.keywordText}</td>
                  <td className="num">{count(t.impressions)}</td>
                  <td className="num">{count(t.clicks)}</td>
                  <td className="num">{inr(t.cost)}</td>
                  <td className="num">{count(t.conversions)}</td>
                  <td className="num">{t.conversions > 0 ? inr(cpa(t)) : '—'}</td>
                  <td className="num">{pct(cvr(t))}</td>
                  <td className="ga-actions">
                    {negated ? (
                      <span style={{ fontSize: 11.5, color: 'var(--g-muted)' }}>Excluded</span>
                    ) : (
                      <button
                        type="button"
                        className="ga-btn"
                        disabled={busy}
                        onClick={() => onAddNegative(t.text, campaignId)}
                      >
                        Add as negative
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--g-muted)', marginTop: 10, lineHeight: 1.55 }}>
        Adding a negative excludes that exact phrase, and only that phrase. It does not
        expand to synonyms: excluding &ldquo;free&rdquo; leaves &ldquo;no cost&rdquo; running.
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────── ads ──

function AdsTab({ state, campaignId, keywords }: Props) {
  const groupIds = new Set(
    state.adGroups.filter((g) => g.campaignId === campaignId).map((g) => g.id),
  );
  const ads = state.ads.filter((a) => groupIds.has(a.adGroupId));
  const groupById = new Map(state.adGroups.map((g) => [g.id, g]));

  if (ads.length === 0) return <Empty title="No ads in this campaign" />;

  return (
    <>
      <div className="ga-note">
        Ad relevance is measured on whether an ad group&rsquo;s keywords appear in its ad.
        One ad cannot answer four unrelated themes at once, which is the whole reason to
        split an ad group up rather than let it sprawl.
      </div>
      <div className="ga-tablewrap">
        <table className="ga-table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Ad group</th>
              <th>Final URL</th>
              <th className="num">Keywords in group</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => {
              const group = groupById.get(ad.adGroupId);
              const inGroup = keywords.filter((k) => k.adGroupId === ad.adGroupId);
              return (
                <tr key={ad.id} className={ad.status !== 'active' ? 'ga-row-paused' : undefined}>
                  <td style={{ maxWidth: 340 }}>
                    <span className="ga-name" style={{ color: 'var(--g-blue)' }}>
                      {ad.headlines[0]}
                    </span>
                    <span className="ga-sub">{ad.headlines.slice(1).join(' · ')}</span>
                    <span className="ga-sub" style={{ color: 'var(--g-ink)' }}>
                      {ad.descriptions[0]}
                    </span>
                  </td>
                  <td>{group?.name ?? '—'}</td>
                  <td style={{ color: 'var(--g-muted)' }}>{ad.finalUrl}</td>
                  <td className="num">
                    {inGroup.length}
                    <span className="ga-sub">
                      {inGroup.slice(0, 3).map((k) => k.text).join(', ')}
                      {inGroup.length > 3 ? '…' : ''}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────── negatives ──

function NegativesTab({ state, campaignId, busy, onAddNegative, onRemoveNegative }: Props) {
  const [draft, setDraft] = useState('');

  const applicable = state.negatives.filter(
    (n) => n.level === 'account' || (n.level === 'campaign' && n.ownerId === campaignId),
  );

  return (
    <>
      <form
        style={{ display: 'flex', gap: 8, marginBottom: 14, maxWidth: 460 }}
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          onAddNegative(text, campaignId);
          setDraft('');
        }}
      >
        <input
          className="ga-input"
          placeholder="Add a negative keyword"
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Negative keyword"
        />
        <button type="submit" className="ga-btn ga-btn-primary" disabled={busy || !draft.trim()}>
          Add
        </button>
      </form>

      {applicable.length === 0 ? (
        <Empty title="No negative keywords">
          Nothing is excluded, so every search your keywords can reach is one you are
          paying for.
        </Empty>
      ) : (
        <div className="ga-tablewrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Negative keyword</th>
                <th>Match type</th>
                <th>Level</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {applicable.map((n) => (
                <tr key={n.id}>
                  <td className="ga-name">{n.text}</td>
                  <td style={{ color: 'var(--g-muted)' }}>{n.match}</td>
                  <td style={{ color: 'var(--g-muted)' }}>
                    {n.level === 'account' ? 'Account' : 'Campaign'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ga-linky"
                      disabled={busy}
                      onClick={() => onRemoveNegative(n.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export { roas };
