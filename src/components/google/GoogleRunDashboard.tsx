'use client';

/**
 * The Google Ads account, live.
 *
 * The organising idea is the left-hand tree, and it is not cosmetic. Selecting a
 * campaign switches the entire workspace to that campaign type's own instrument
 * panel: a Search campaign gets keywords, search terms, ads and negatives; a
 * Performance Max campaign gets a categories report and a brand-exclusion control
 * and conspicuously no keyword table; an App campaign gets a channel breakdown and
 * a goal selector and no placement control at all.
 *
 * That difference *is* the curriculum. The three campaign types are not three skins
 * on one buying model — they are three genuinely different products with different
 * levers, and a single unified table would flatten exactly the distinction a learner
 * is here to acquire. What you can see and what you can change should differ by
 * campaign type, because in the real product they do.
 *
 * Everything on screen is derived from days the engine produced. The component
 * never computes a metric of its own; it asks `lib/gsim/view` and renders the
 * answer, so a figure in a footer and the same figure in a row cannot disagree.
 */

import { useCallback, useMemo, useState } from 'react';
import type { GDayResult, GState } from '@/lib/gsim/engine/types';
import type { AppSettings } from '@/lib/gsim/engine/app';
import {
  accountTotals, appChannelRows, appTotals, campaignRows, cpa, cpc, ctr, cvr,
  inWindow, inr, keywordRows, pmaxRows, pct, count, roas, termRows, windowsFor,
  type KeywordRow,
} from '@/lib/gsim/view';
import { GoogleAdsStyles } from './ads-manager/styles';
import { Empty, Kpi, TypeChip } from './ads-manager/shared';
import { SEARCH_TABS, SearchPanel, type SearchTab } from './ads-manager/SearchPanel';
import { PMAX_TABS, PmaxPanel, type PmaxTab } from './ads-manager/PmaxPanel';
import { APP_TABS, AppPanel, type AppTab } from './ads-manager/AppPanel';

interface Props {
  accountId: string;
  initialState: GState;
  initialDays: GDayResult[];
  /** The fictional company this account belongs to, for the header and the
   *  brand-exclusion copy. */
  brand: string;
  verticalLabel: string;
  /** Break-even return on ad spend, from the vertical's own margin. */
  breakEven: number;
  /** What a customer may cost at most. Used by the App panel. */
  ceiling: number;
  conversionName: string;
  /**
   * Called whenever the clock moves.
   *
   * The mission panel sits beside this component and needs the same day number —
   * its brief counts down, and its grade button unlocks at the horizon. Without
   * this the panel would keep the day it was rendered with on the server, tell a
   * learner standing on the last day that they had fourteen left, and refuse to
   * grade a run that was over.
   */
  onDayChange?: (day: number) => void;
}

type Pending =
  | { kind: 'campaign_budget'; id: string; title: string; value: number; unit: '₹' }
  | { kind: 'keyword_bid'; id: string; title: string; value: number; unit: '₹' }
  | { kind: 'campaign_pmax_reach'; id: string; title: string; value: number; unit: '' }
  | { kind: 'app_target'; id: string; title: string; value: number; unit: '₹' | '%' }
  | { kind: 'app_assets'; id: string; title: string; value: number; unit: ''; assetKind: 'images' | 'videos' };

export function GoogleRunDashboard(props: Props) {
  const [state, setState] = useState<GState>(props.initialState);
  const [days, setDays] = useState<GDayResult[]>(props.initialDays);
  const [selected, setSelectedRaw] = useState<string | null>(null);
  const [searchTab, setSearchTab] = useState<SearchTab>('keywords');
  const [pmaxTab, setPmaxTab] = useState<PmaxTab>('categories');
  const [appTab, setAppTab] = useState<AppTab>('channels');
  const [windowIndex, setWindowIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, setPending] = useState<{ edit: Pending; anchor: DOMRect } | null>(null);

  /** Changing what you are looking at clears the last message, because it
   *  described something that happened somewhere else. */
  const setSelected = useCallback((id: string | null) => {
    setSelectedRaw(id);
    setFlash(null);
    setError(null);
  }, []);

  const windows = useMemo(() => windowsFor(state.day), [state.day]);
  const activeWindow = windows[Math.min(windowIndex, windows.length - 1)];
  const shownDays = useMemo(() => inWindow(days, activeWindow), [days, activeWindow]);

  const campaigns = useMemo(() => campaignRows(state, shownDays), [state, shownDays]);

  const campaign = selected ? state.campaigns.find((c) => c.id === selected) ?? null : null;

  // The strip reports whatever is selected, not the account. Showing account
  // totals under a campaign's name would be worse than useless here: an App
  // campaign buying ₹1 display clicks drags the blended CPC to ₹5, and a learner
  // reading that figure beneath the heading "Search — All Products" would draw
  // exactly the wrong conclusion about what their keywords cost.
  const totals = useMemo(
    () => (selected
      ? campaigns.find((c) => c.id === selected) ?? accountTotals([])
      : accountTotals(shownDays)),
    [selected, campaigns, shownDays],
  );

  // ── server calls ───────────────────────────────────────────────────────
  const post = useCallback(async (path: string, body: object) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? 'Something went wrong.');
    return json;
  }, []);

  const advance = useCallback(async (n: number) => {
    setBusy(true); setError(null); setFlash(null);
    try {
      const json = await post('/api/gsim/tick', { accountId: props.accountId, days: n });
      setState(json.state as GState);
      setDays((prev) => [...prev, ...(json.results as GDayResult[])]);
      props.onDayChange?.(json.currentDay as number);
      // Snap back to the most recent window, since the learner just asked to see
      // what happened rather than what had already happened.
      setWindowIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not advance the day.');
    } finally {
      setBusy(false);
    }
  }, [post, props]);

  const edit = useCallback(async (payload: object, note?: string) => {
    setBusy(true); setError(null);
    try {
      const json = await post('/api/gsim/edit', { accountId: props.accountId, edit: payload });
      setState(json.state as GState);
      setFlash(
        json.resetLearning
          ? `${json.note} — this restarts the bid strategy's learning period.`
          : (note ?? json.note),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply that change.');
    } finally {
      setBusy(false);
    }
  }, [post, props.accountId]);

  // ── edit helpers ───────────────────────────────────────────────────────
  const openEdit = (e: Pending, anchor: DOMRect) => { setPending({ edit: e, anchor }); };

  const commitPending = async (raw: number) => {
    if (!pending) return;
    const p = pending.edit;
    setPending(null);
    switch (p.kind) {
      case 'campaign_budget':
        return edit({ kind: 'campaign_budget', id: p.id, dailyBudget: raw });
      case 'keyword_bid':
        return edit({ kind: 'keyword_bid', id: p.id, maxCpc: raw });
      case 'campaign_pmax_reach':
        return edit({ kind: 'campaign_pmax_reach', id: p.id, pmaxReach: raw });
      case 'app_target':
      case 'app_assets':
        return applyAppChange(p, raw);
    }
  };

  /**
   * App settings do not go through `applyEdit`, because they are not one of its
   * cases — an App campaign's goal, targets and assets live on a sub-object the
   * generic edit vocabulary does not reach. Rather than widen that vocabulary for
   * one campaign type, the change is made here and posted as a whole-campaign
   * update through the same validated route.
   */
  const applyAppChange = async (p: Extract<Pending, { kind: 'app_target' | 'app_assets' }>, raw: number) => {
    const c = state.campaigns.find((x) => x.id === p.id);
    if (!c?.app) return;
    const next: AppSettings = { ...c.app, assets: { ...c.app.assets } };
    if (p.kind === 'app_assets') {
      next.assets[p.assetKind] = Math.max(0, Math.round(raw));
    } else if (next.goal === 'installs') {
      next.targetCpi = raw;
    } else if (next.goal === 'roas') {
      next.targetRoas = raw / 100;
    } else {
      next.targetEventCpa = raw;
    }
    await postAppSettings(p.id, next);
  };

  const postAppSettings = useCallback(async (campaignId: string, app: AppSettings) => {
    setBusy(true); setError(null);
    try {
      const json = await post('/api/gsim/app', { accountId: props.accountId, campaignId, app });
      setState(json.state as GState);
      setFlash(json.note as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply that change.');
    } finally {
      setBusy(false);
    }
  }, [post, props.accountId]);

  const setAppGoal = (campaignId: string, goal: AppSettings['goal']) => {
    const c = state.campaigns.find((x) => x.id === campaignId);
    if (!c?.app) return;
    const next: AppSettings = { ...c.app, goal, assets: { ...c.app.assets } };
    // Carry a sensible target across, so switching goal does not silently leave a
    // cost-per-install target governing a cost-per-purchase campaign.
    if (goal === 'in_app_action' && !next.targetEventCpa) next.targetEventCpa = Math.round(props.ceiling * 0.9);
    if (goal === 'installs' && !next.targetCpi) next.targetCpi = 60;
    if (goal === 'roas' && !next.targetRoas) next.targetRoas = 2;
    void postAppSettings(campaignId, next);
  };

  const addNegative = (text: string, campaignId: string) =>
    edit(
      { kind: 'add_negative', negative: { level: 'campaign', ownerId: campaignId, text, match: 'phrase' } },
      `Excluded "${text}". It stops matching from the next day forward — spend already made is spent.`,
    );

  const removeNegative = (id: string) => edit({ kind: 'remove_negative', id });

  const toggleKeyword = (row: KeywordRow) =>
    edit({ kind: 'keyword_status', id: row.id, status: row.status === 'active' ? 'paused' : 'active' });

  // ── render ─────────────────────────────────────────────────────────────
  const breakEvenOk = roas(totals) >= props.breakEven;

  return (
    <div className="ga-shell">
      <GoogleAdsStyles />

      <aside className="ga-side">
        <div className="ga-acct">
          <div className="ga-acct-name">{props.brand}</div>
          <div className="ga-acct-sub">{props.verticalLabel}</div>
        </div>

        <button
          type="button"
          className={selected === null ? 'ga-nav-item ga-nav-on' : 'ga-nav-item'}
          onClick={() => setSelected(null)}
        >
          <span className="ga-nav-text">All campaigns</span>
          <span className="ga-nav-spend">{inr(totals.cost)}</span>
        </button>

        <div className="ga-nav-label">Campaigns</div>
        {campaigns.map((c) => (
          <button
            key={c.id}
            type="button"
            className={selected === c.id ? 'ga-nav-item ga-nav-on' : 'ga-nav-item'}
            data-paused={c.status !== 'active'}
            onClick={() => setSelected(c.id)}
          >
            <span className="ga-nav-text" title={c.name}>{c.name}</span>
            <span className="ga-nav-spend">{inr(c.cost)}</span>
          </button>
        ))}
      </aside>

      <main className="ga-main">
        <div className="ga-topbar">
          <div>
            {campaign ? (
              <div className="ga-crumb">
                <button type="button" onClick={() => setSelected(null)}>All campaigns</button>
                <span>›</span>
                <TypeChip
                  type={campaign.type}
                  label={campaigns.find((c) => c.id === campaign.id)?.typeLabel ?? campaign.type}
                />
              </div>
            ) : (
              <div className="ga-crumb">{props.brand} · Google Ads</div>
            )}
            <h2 className="ga-title">{campaign ? campaign.name : 'All campaigns'}</h2>
          </div>

          <div className="ga-controls">
            <select
              className="ga-select"
              value={windowIndex}
              onChange={(e) => setWindowIndex(Number(e.target.value))}
              aria-label="Date range"
            >
              {windows.map((w, i) => <option key={w.label} value={i}>{w.label}</option>)}
            </select>
          </div>
        </div>

        <div className="ga-clock">
          <span className="ga-clock-day">Day {state.day}</span>
          <span className="ga-clock-note">
            Nothing changes until time passes. Make your edits, then advance and read what
            happened.
          </span>
          <button type="button" className="ga-btn" disabled={busy} onClick={() => advance(1)}>
            {busy ? 'Running…' : '+1 day'}
          </button>
          <button type="button" className="ga-btn" disabled={busy} onClick={() => advance(7)}>
            +1 week
          </button>
        </div>

        {error ? <div className="ga-err" role="alert">{error}</div> : null}
        {flash ? <div className="ga-note">{flash}</div> : null}

        {state.day === 0 ? (
          <Empty title="The account has not run yet">
            Advance a day to see what these settings actually buy.
          </Empty>
        ) : (
          <>
            <div className="ga-kpis">
              <Kpi label="Cost" value={inr(totals.cost)} />
              <Kpi label="Impressions" value={count(totals.impressions)} />
              <Kpi label="Clicks" value={count(totals.clicks)} note={pct(ctr(totals))} />
              <Kpi label="Avg. CPC" value={inr(cpc(totals))} />
              <Kpi label={props.conversionName} value={count(totals.conversions)} note={pct(cvr(totals))} />
              <Kpi
                label={`Cost / ${props.conversionName.toLowerCase()}`}
                value={totals.conversions > 0 ? inr(cpa(totals)) : '—'}
              />
              <Kpi
                label="Conv. value / cost"
                value={roas(totals).toFixed(2)}
                note={`break-even ${props.breakEven.toFixed(2)}`}
                tone={totals.cost > 0 ? (breakEvenOk ? 'good' : 'bad') : undefined}
              />
            </div>

            {campaign ? (
              <CampaignWorkspace
                {...props}
                state={state}
                days={shownDays}
                campaignId={campaign.id}
                busy={busy}
                searchTab={searchTab} setSearchTab={setSearchTab}
                pmaxTab={pmaxTab} setPmaxTab={setPmaxTab}
                appTab={appTab} setAppTab={setAppTab}
                openEdit={openEdit}
                onAddNegative={addNegative}
                onRemoveNegative={removeNegative}
                onToggleKeyword={toggleKeyword}
                onSetAppGoal={setAppGoal}
              />
            ) : (
              <AllCampaigns
                rows={campaigns}
                busy={busy}
                onSelect={setSelected}
                onEditBudget={(id, name, value, anchor) =>
                  openEdit({ kind: 'campaign_budget', id, title: `Daily budget — ${name}`, value, unit: '₹' }, anchor)}
                conversionName={props.conversionName}
              />
            )}
          </>
        )}

        {pending ? (
          <NumberPopover
            pending={pending}
            onCancel={() => setPending(null)}
            onCommit={commitPending}
          />
        ) : null}
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────── all-campaigns view ──

function AllCampaigns({
  rows, busy, onSelect, onEditBudget, conversionName,
}: {
  rows: ReturnType<typeof campaignRows>;
  busy: boolean;
  onSelect: (id: string) => void;
  onEditBudget: (id: string, name: string, value: number, anchor: DOMRect) => void;
  conversionName: string;
}) {
  if (rows.length === 0) return <Empty title="No campaigns" />;

  const anyCapped = rows.some((r) => r.budgetCappedDays > 0);

  return (
    <>
      {anyCapped ? (
        <div className="ga-note ga-note-amber">
          One or more campaigns ran out of budget on at least one day. A capped campaign
          stops entering auctions partway through the day — which is a choice about
          <i> which</i> searches you buy, not just how many.
        </div>
      ) : null}
      <div className="ga-tablewrap">
        <table className="ga-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Type</th>
              <th className="num">Budget</th>
              <th>Bidding</th>
              <th className="num">Impr.</th>
              <th className="num">Clicks</th>
              <th className="num">Avg. CPC</th>
              <th className="num">Cost</th>
              <th className="num">{conversionName}</th>
              <th className="num">Cost / conv.</th>
              <th className="num">Value / cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={c.status !== 'active' ? 'ga-row-paused' : undefined}>
                <td>
                  <button type="button" className="ga-linky ga-name" onClick={() => onSelect(c.id)}>
                    {c.name}
                  </button>
                  {c.budgetCappedDays > 0 ? (
                    <span className="ga-sub" style={{ color: 'var(--g-amber)' }}>
                      Limited by budget on {c.budgetCappedDays} day{c.budgetCappedDays === 1 ? '' : 's'}
                    </span>
                  ) : null}
                  {c.blocked ? (
                    <span className="ga-sub" style={{ color: 'var(--g-red)' }}>{c.blocked}</span>
                  ) : null}
                </td>
                <td><TypeChip type={c.type} label={c.typeLabel} /></td>
                <td className="num">
                  <button
                    type="button"
                    className="ga-cell-edit"
                    disabled={busy}
                    aria-label={`Edit budget for ${c.name}`}
                    onClick={(e) => onEditBudget(c.id, c.name, c.dailyBudget, e.currentTarget.getBoundingClientRect())}
                  >
                    {inr(c.dailyBudget)}
                  </button>
                </td>
                <td style={{ color: 'var(--g-muted)' }}>{c.bidStrategyLabel}</td>
                <td className="num">{count(c.impressions)}</td>
                <td className="num">{count(c.clicks)}</td>
                <td className="num">{inr(cpc(c))}</td>
                <td className="num">{inr(c.cost)}</td>
                <td className="num">
                  {count(c.conversions)}
                  {c.installs !== undefined ? (
                    <span className="ga-sub">{count(c.installs)} installs</span>
                  ) : null}
                </td>
                <td className="num">{c.conversions > 0 ? inr(cpa(c)) : '—'}</td>
                <td className="num">{roas(c).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────── campaign switch ──

/**
 * The switch the whole design turns on.
 *
 * One campaign is selected, and its *type* decides which instrument panel appears.
 * There is no shared "campaign detail" view underneath these because there is no
 * shared thing to show: keywords are meaningless for Performance Max, a channel
 * breakdown is meaningless for Search, and pretending otherwise would teach a
 * learner that the three types are interchangeable when the entire skill is knowing
 * that they are not.
 */
function CampaignWorkspace(props: {
  state: GState;
  days: GDayResult[];
  campaignId: string;
  busy: boolean;
  brand: string;
  ceiling: number;
  searchTab: SearchTab; setSearchTab: (t: SearchTab) => void;
  pmaxTab: PmaxTab; setPmaxTab: (t: PmaxTab) => void;
  appTab: AppTab; setAppTab: (t: AppTab) => void;
  openEdit: (e: Pending, anchor: DOMRect) => void;
  onAddNegative: (text: string, campaignId: string) => void;
  onRemoveNegative: (id: string) => void;
  onToggleKeyword: (row: KeywordRow) => void;
  onSetAppGoal: (campaignId: string, goal: AppSettings['goal']) => void;
}) {
  const { state, days, campaignId, busy } = props;
  const campaign = state.campaigns.find((c) => c.id === campaignId);

  const keywords = useMemo(
    () => keywordRows(state, days, campaignId), [state, days, campaignId],
  );
  const terms = useMemo(() => termRows(state, days, campaignId), [state, days, campaignId]);

  if (!campaign) return <Empty title="Campaign not found" />;

  if (campaign.type === 'search') {
    return (
      <>
        <Tabs items={SEARCH_TABS} active={props.searchTab} onChange={props.setSearchTab} />
        <SearchPanel
          tab={props.searchTab}
          state={state}
          campaignId={campaignId}
          keywords={keywords}
          terms={terms}
          busy={busy}
          onEditBid={(row, anchor) => props.openEdit(
            { kind: 'keyword_bid', id: row.id, title: `Max CPC — ${row.display}`, value: row.maxCpc ?? 0, unit: '₹' },
            anchor,
          )}
          onToggleKeyword={props.onToggleKeyword}
          onAddNegative={props.onAddNegative}
          onRemoveNegative={props.onRemoveNegative}
        />
      </>
    );
  }

  if (campaign.type === 'pmax') {
    return (
      <>
        <Tabs items={PMAX_TABS} active={props.pmaxTab} onChange={props.setPmaxTab} />
        <PmaxPanel
          tab={props.pmaxTab}
          campaign={campaign}
          rows={pmaxRows(days, campaignId)}
          negatives={state.negatives}
          busy={busy}
          brandName={props.brand}
          onAddNegative={props.onAddNegative}
          onRemoveNegative={props.onRemoveNegative}
          onEditReach={(anchor) => props.openEdit(
            { kind: 'campaign_pmax_reach', id: campaignId, title: 'Reach (0 – 2)', value: campaign.pmaxReach ?? 1, unit: '' },
            anchor,
          )}
        />
      </>
    );
  }

  if (campaign.type === 'app' && campaign.app) {
    const app = campaign.app;
    const targetValue = app.goal === 'installs' ? (app.targetCpi ?? 0)
      : app.goal === 'roas' ? Math.round((app.targetRoas ?? 1) * 100)
        : (app.targetEventCpa ?? 0);
    return (
      <>
        <Tabs items={APP_TABS} active={props.appTab} onChange={props.setAppTab} />
        <AppPanel
          tab={props.appTab}
          campaign={campaign}
          app={app}
          totals={appTotals(days, campaignId)}
          channels={appChannelRows(days, campaignId)}
          ceiling={props.ceiling}
          busy={busy}
          onSetGoal={(goal) => props.onSetAppGoal(campaignId, goal)}
          onEditTarget={(anchor) => props.openEdit(
            {
              kind: 'app_target', id: campaignId, value: targetValue,
              title: app.goal === 'roas' ? 'Target ROAS (%)' : 'Target',
              unit: app.goal === 'roas' ? '%' : '₹',
            },
            anchor,
          )}
          onEditAssets={(kind, anchor) => props.openEdit(
            {
              kind: 'app_assets', id: campaignId, assetKind: kind, unit: '',
              title: kind === 'images' ? 'Number of images' : 'Number of videos',
              value: app.assets[kind],
            },
            anchor,
          )}
        />
      </>
    );
  }

  return <Empty title="This campaign type is not simulated yet" />;
}

function Tabs<T extends string>({
  items, active, onChange,
}: {
  items: { id: T; label: string }[];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="ga-tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={active === t.id ? 'ga-tab ga-tab-on' : 'ga-tab'}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────── popover ──

function NumberPopover({
  pending, onCancel, onCommit,
}: {
  pending: { edit: Pending; anchor: DOMRect };
  onCancel: () => void;
  onCommit: (value: number) => void;
}) {
  const [raw, setRaw] = useState(String(pending.edit.value));
  const value = Number(raw);
  const valid = Number.isFinite(value) && value >= 0;

  return (
    <>
      <button className="ga-backdrop" onClick={onCancel} aria-label="Cancel" />
      <div
        className="ga-pop"
        style={{
          top: Math.min(pending.anchor.bottom + window.scrollY + 6, window.scrollY + window.innerHeight - 190),
          left: Math.max(12, Math.min(pending.anchor.left + window.scrollX - 40, window.innerWidth - 260)),
        }}
      >
        <div className="ga-pop-label">{pending.edit.title}</div>
        <input
          className="ga-input"
          value={raw}
          autoFocus
          inputMode="decimal"
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid) onCommit(value);
            if (e.key === 'Escape') onCancel();
          }}
          aria-label={pending.edit.title}
        />
        <div className="ga-pop-row">
          <button type="button" className="ga-btn" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="ga-btn ga-btn-primary"
            disabled={!valid}
            onClick={() => onCommit(value)}
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
