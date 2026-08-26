'use client';

/**
 * A Performance Max campaign's workspace.
 *
 * Conspicuously thinner than the Search one, and that is the point rather than an
 * omission. Performance Max gives you a budget field, a target, a set of assets and
 * a categories report. There is no keyword table because there are no keywords, and
 * no search terms report because Google does not provide one — it reports the
 * *categories* of search it bought and withholds the searches themselves.
 *
 * Which is exactly why brand cannibalisation is so hard to catch in real accounts.
 * The traffic leaves the Search campaign, arrives here, and the one report that
 * would prove it does not exist. A learner has to diagnose it the way a buyer
 * actually does: by noticing that the Search brand campaign's impression share fell
 * on a day nothing about the Search brand campaign changed.
 *
 * So the panel says so, in as many words, and points at where to look.
 */

import { cpa, count, inr, pct, roas } from '@/lib/gsim/view';
import type { PmaxInsightRow } from '@/lib/gsim/engine/types';
import type { GCampaign, GNegative } from '@/lib/gsim/engine/types';
import { Empty } from './shared';

export type PmaxTab = 'categories' | 'settings';

export const PMAX_TABS: { id: PmaxTab; label: string }[] = [
  { id: 'categories', label: 'Search categories' },
  { id: 'settings', label: 'Settings & exclusions' },
];

interface Props {
  tab: PmaxTab;
  campaign: GCampaign;
  rows: PmaxInsightRow[];
  negatives: GNegative[];
  busy: boolean;
  brandName: string;
  onAddNegative: (text: string, campaignId: string) => void;
  onRemoveNegative: (id: string) => void;
  onEditReach: (anchor: DOMRect) => void;
}

export function PmaxPanel(props: Props) {
  return props.tab === 'categories' ? <CategoriesTab {...props} /> : <SettingsTab {...props} />;
}

function CategoriesTab({ rows, brandName }: Props) {
  const brand = rows.find((r) => r.category === 'Brand');
  const total = rows.reduce((n, r) => n + r.cost, 0);

  return (
    <>
      <div className="ga-note ga-note-amber">
        <b>This is not a search terms report.</b> Performance Max reports the
        <i> categories</i> of search it bought and does not show the searches themselves.
        If it is taking traffic your Search campaigns were already winning, you will not
        find the evidence here — you will find it as a fall in those campaigns&rsquo;
        impression share.
      </div>

      {rows.length === 0 ? (
        <Empty title="No data yet">Advance a few days to see where this campaign spent.</Empty>
      ) : (
        <>
          {brand && brand.cost > 0 ? (
            <div className="ga-note ga-note-red">
              <b>{pct(brand.cost / Math.max(1, total), 0)}</b> of this campaign&rsquo;s spend went
              to searches in the <b>Brand</b> category — people who typed{' '}
              {brandName}. Those are the cheapest and best-converting searches in any
              account, which is why Performance Max wants them and why taking them makes
              its own numbers look excellent.
            </div>
          ) : null}

          <div className="ga-tablewrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Search category</th>
                  <th className="num">Impr.</th>
                  <th className="num">Clicks</th>
                  <th className="num">Cost</th>
                  <th className="num">Conv.</th>
                  <th className="num">Cost / conv.</th>
                  <th className="num">Conv. value / cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.category}>
                    <td className="ga-name">{r.category}</td>
                    <td className="num">{count(r.impressions)}</td>
                    <td className="num">{count(r.clicks)}</td>
                    <td className="num">{inr(r.cost)}</td>
                    <td className="num">{count(r.conversions)}</td>
                    <td className="num">{r.conversions > 0 ? inr(cpa(r)) : '—'}</td>
                    <td className="num">{roas(r).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function SettingsTab({
  campaign, negatives, busy, brandName, onAddNegative, onRemoveNegative, onEditReach,
}: Props) {
  const exclusions = negatives.filter((n) => n.level === 'campaign' && n.ownerId === campaign.id);
  const hasBrandExclusion = exclusions.some(
    (n) => n.text.toLowerCase() === brandName.toLowerCase(),
  );

  return (
    <>
      <div className="ga-tablewrap" style={{ marginBottom: 18 }}>
        <table className="ga-table">
          <tbody>
            <tr>
              <td style={{ width: 200, color: 'var(--g-muted)' }}>Daily budget</td>
              <td className="ga-name">{inr(campaign.dailyBudget)}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--g-muted)' }}>Bidding</td>
              <td className="ga-name">
                {campaign.bidStrategy === 'target_roas' && campaign.targetRoas
                  ? `Target ROAS · ${Math.round(campaign.targetRoas * 100)}%`
                  : campaign.bidStrategy === 'target_cpa' && campaign.targetCpa
                    ? `Target CPA · ${inr(campaign.targetCpa)}`
                    : 'Maximise conversions'}
              </td>
            </tr>
            <tr>
              <td style={{ color: 'var(--g-muted)' }}>
                Reach
                <span className="ga-sub">
                  How far past obvious commercial intent it will go
                </span>
              </td>
              <td>
                <button
                  type="button"
                  className="ga-cell-edit ga-name"
                  disabled={busy}
                  onClick={(e) => onEditReach(e.currentTarget.getBoundingClientRect())}
                  aria-label="Edit reach"
                >
                  {(campaign.pmaxReach ?? 1).toFixed(2)}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 6px' }}>Brand exclusions</h3>
      <p style={{ fontSize: 12.5, color: 'var(--g-muted)', lineHeight: 1.55, margin: '0 0 12px' }}>
        The only way to stop Performance Max entering auctions for your own brand — apart
        from holding those auctions with an exact-match brand keyword in a Search
        campaign, which takes precedence over Performance Max by rule.
      </p>

      {!hasBrandExclusion ? (
        <div className="ga-note ga-note-amber">
          Nothing excluded. This campaign is free to bid on <b>{brandName}</b>, and it will.
        </div>
      ) : null}

      <form
        style={{ display: 'flex', gap: 8, marginBottom: 14, maxWidth: 460 }}
        onSubmit={(e) => {
          e.preventDefault();
          const input = (e.currentTarget.elements.namedItem('excl') as HTMLInputElement);
          const text = input.value.trim();
          if (!text) return;
          onAddNegative(text, campaign.id);
          input.value = '';
        }}
      >
        <input className="ga-input" name="excl" placeholder="Exclude a brand term" maxLength={80} aria-label="Brand exclusion" />
        <button type="submit" className="ga-btn ga-btn-primary" disabled={busy}>Exclude</button>
      </form>

      {exclusions.length > 0 ? (
        <div className="ga-tablewrap">
          <table className="ga-table">
            <thead>
              <tr><th>Excluded term</th><th>Match</th><th style={{ width: 90 }} /></tr>
            </thead>
            <tbody>
              {exclusions.map((n) => (
                <tr key={n.id}>
                  <td className="ga-name">{n.text}</td>
                  <td style={{ color: 'var(--g-muted)' }}>{n.match}</td>
                  <td>
                    <button type="button" className="ga-linky" disabled={busy} onClick={() => onRemoveNegative(n.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
