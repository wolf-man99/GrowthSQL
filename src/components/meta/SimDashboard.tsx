'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronDown, Play, Plus, Search, SlidersHorizontal } from 'lucide-react';
import {
  AudiencesPanel, COLUMNS, DEFAULT_COLUMNS, FOOTER_SKIP, Kpi, ReportingPanel, TableRow,
  groupRows, num, sumRows,
  type DisplayRow,
} from '@/components/meta/ads-manager/shared';
import { AdsManagerStyles } from '@/components/meta/ads-manager/styles';
import { CreateFlow, type CreateLevel } from '@/components/meta/ads-manager/CreateFlow';
import { inr } from '@/lib/simulator/demo-account';
import type { SimRows } from '@/lib/simulator/view';
import type { SimEdit, SimState } from '@/lib/simulator/engine';
import { RANGE_OPTIONS } from '@/lib/simulator/ranges';
import { breakdownFor, combineBreakdowns, type BreakdownKind } from '@/lib/simulator/breakdowns';

/**
 * The live Run account.
 *
 * Same chrome as the frozen case-study viewer, but this one is an account the
 * learner operates: the delivery switches actually pause things, budgets are
 * editable, and the clock only moves when they decide to move it.
 *
 * Two behaviours are worth calling out because they are teaching decisions rather
 * than UI decisions:
 *
 *   - Advancing is explicit. Nothing happens while a learner sits and reads, so
 *     they can study a day's numbers for as long as they like before committing to
 *     the next one. That is the opposite of a real account, and deliberately so.
 *
 *   - Edits that would restart the learning phase are previewed before they apply.
 *     Springing the rule after the fact would punish; naming it beforehand teaches
 *     it. The server decides, not this component, so the warning can never drift
 *     out of step with what actually happens.
 */

const NAV_ITEMS = [
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'adsets', label: 'Ad sets' },
  { key: 'ads', label: 'Ads' },
  { key: 'audiences', label: 'Audiences' },
  { key: 'reporting', label: 'Reporting' },
] as const;
type NavKey = (typeof NAV_ITEMS)[number]['key'];
const DATA_LEVELS = new Set<NavKey>(['campaigns', 'adsets', 'ads']);
const LEVEL_TITLE: Record<NavKey, string> = {
  campaigns: 'Campaigns', adsets: 'Ad sets', ads: 'Ads',
  audiences: 'Audiences', reporting: 'Reporting',
};
const LEVEL_NAME_HEADER: Record<string, string> = { campaigns: 'Campaign', adsets: 'Ad set', ads: 'Ad' };
const FILTERS = ['All', 'Prospecting', 'Retargeting', 'Catalog'] as const;
const EDITABLE_BUDGET = new Set(['budget']);

export interface SimDashboardProps {
  accountId: string;
  brandName: string;
  brandCategory: string;
  currentDay: number;
  state: SimState;
  rows: SimRows;
  totals: { spend: number; revenue: number; purchases: number; impressions: number; linkClicks: number; reach: number };
  rangeKey: string;
  rangeLabel: string;
  /** A mission's horizon. Advancing stops here so a run cannot overshoot its brief. */
  maxDay?: number;
  /** A graded or abandoned account is a record, not a workspace. */
  readOnly?: boolean;
}

export function SimDashboard(props: SimDashboardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nav, setNav] = useState<NavKey>('campaigns');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [enabledColumns, setEnabledColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [reportBy, setReportBy] = useState('filterType');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ column: string; dir: 'asc' | 'desc' } | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; level: 'campaign' | 'adset'; value: string } | null>(null);
  const [creating, setCreating] = useState<CreateLevel | null>(null);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  /** Posts to a simulator route, surfacing the server's own message on failure. */
  const post = useCallback(async (path: string, body: unknown): Promise<Record<string, unknown> | null> => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Something went wrong. Try again.');
        return null;
      }
      return data as Record<string, unknown>;
    } catch {
      setError('Network error. Your account is safe; nothing was changed.');
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const advance = useCallback(async (days: number) => {
    setNotice(null);
    const data = await post('/api/sim/tick', { accountId: props.accountId, days });
    if (data) {
      setNotice(days === 1 ? 'Advanced one day.' : `Advanced ${days} days.`);
      refresh();
    }
  }, [post, props.accountId, refresh]);

  /**
   * Applies an edit, asking first when it would cost accumulated learning.
   *
   * The preview call is what makes the learning-phase rule teachable rather than
   * punitive: the learner is told which ad sets they are about to reset, by name,
   * and gets to decide. The server is the authority on both the preview and the
   * apply, so the two cannot disagree.
   */
  const applyEdit = useCallback(async (edit: SimEdit, describe?: string) => {
    setNotice(null);
    const preview = await post('/api/sim/edit', { accountId: props.accountId, edit, preview: true });
    if (!preview) return;

    const resets = Array.isArray(preview.resetAdSetIds) ? (preview.resetAdSetIds as string[]) : [];
    if (resets.length > 0) {
      const names = resets
        .map((id) => props.state.adSets.find((a) => a.id === id)?.name ?? id)
        .join(', ');
      const ok = window.confirm(
        `This restarts the learning phase on ${resets.length} ad set${resets.length > 1 ? 's' : ''}:\n\n${names}\n\n` +
        'They will go back to exploring, which is less stable and more expensive until they gather ~50 events again. Continue?',
      );
      if (!ok) return;
    }

    const data = await post('/api/sim/edit', { accountId: props.accountId, edit });
    if (data) {
      const reset = Array.isArray(data.resetAdSetIds) ? (data.resetAdSetIds as string[]).length : 0;
      setNotice(
        reset > 0
          ? `${describe ?? 'Change saved'}. ${reset} ad set${reset > 1 ? 's are' : ' is'} back in the learning phase.`
          : `${describe ?? 'Change saved'}.`,
      );
      refresh();
    }
  }, [post, props.accountId, props.state.adSets, refresh]);

  /**
   * Applies several edits in sequence.
   *
   * Creating an ad set and its first ad is two edits, and the second depends on the
   * first having landed, so they cannot be fired in parallel. Stops at the first
   * failure rather than pressing on, which would leave a half-built campaign.
   */
  const submitEdits = useCallback(async (edits: SimEdit[], describe: string) => {
    setNotice(null);
    for (const edit of edits) {
      const data = await post('/api/sim/edit', { accountId: props.accountId, edit });
      if (!data) return;
    }
    setCreating(null);
    setNotice(`${describe}. It starts delivering when you next advance the clock.`);
    refresh();
  }, [post, props.accountId, refresh]);

  const toggleStatus = useCallback((level: 'campaign' | 'adset' | 'ad') => (id: string, paused: boolean) => {
    void applyEdit(
      { kind: 'setStatus', level, id, status: paused ? 'active' : 'paused' },
      paused ? 'Resumed' : 'Paused',
    );
  }, [applyEdit]);

  const commitBudget = useCallback(() => {
    if (!editing) return;
    const value = Math.round(Number(editing.value));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a daily budget above zero.');
      return;
    }
    const edit: SimEdit = editing.level === 'campaign'
      ? { kind: 'setCampaignBudget', id: editing.id, dailyBudget: value }
      : { kind: 'setAdSetBudget', id: editing.id, dailyBudget: value };
    setEditing(null);
    void applyEdit(edit, `Budget set to ${inr(value)}/day`);
  }, [editing, applyEdit]);

  const levelRows: DisplayRow[] = useMemo(() => (
    nav === 'campaigns' ? props.rows.campaigns
    : nav === 'adsets' ? props.rows.adSets
    : nav === 'ads' ? props.rows.ads
    : []
  ), [nav, props.rows]);
  const visibleColumns = COLUMNS.filter((c) => enabledColumns.includes(c.id));

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = levelRows.filter((r) =>
      (filter === 'All' || r.filterType === filter)
      && (needle === '' || r.name.toLowerCase().includes(needle) || r.subtitle.toLowerCase().includes(needle)));
    if (!sort) return filtered;

    const column = COLUMNS.find((c) => c.id === sort.column);
    if (!column) return filtered;
    // Numeric columns sort on the underlying value rather than the rendered
    // string, or "₹1,00,000" would sort below "₹9,000" alphabetically.
    const value = (r: DisplayRow): number | string => {
      if (!column.numeric) return column.render(r).toLowerCase();
      const raw = column.render(r).replace(/[^0-9.-]/g, '');
      const n = Number.parseFloat(raw);
      return Number.isFinite(n) ? n : -Infinity;
    };
    return [...filtered].sort((a, b) => {
      const av = value(a); const bv = value(b);
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [levelRows, filter, query, sort]);

  function toggleSort(columnId: string) {
    setSort((prev) =>
      prev?.column !== columnId ? { column: columnId, dir: 'desc' }
      : prev.dir === 'desc' ? { column: columnId, dir: 'asc' }
      : null);
  }

  const footer = useMemo(() => sumRows(rows), [rows]);
  const footerRow: DisplayRow = {
    id: 'footer', name: '', subtitle: '', filterType: 'All', delivery: '',
    bidStrategyText: '', budgetText: '', t: footer.t, reach: footer.reach, funnel: footer.funnel,
  };

  const isBreakdown = reportBy === 'age' || reportBy === 'gender' || reportBy === 'placement';

  const reportGroups = useMemo(() => {
    if (!isBreakdown) {
      return groupRows(props.rows.campaigns, reportBy === 'delivery' ? (r) => r.delivery : (r) => r.filterType);
    }
    // Each ad set's totals split by its own audience's weights, then summed by
    // segment, so an account mixing a narrow age band with a broad one shows the
    // honest blend rather than one audience's shape applied to everything.
    const audienceById = new Map(props.state.audiences.map((a) => [a.id, a]));
    const perAdSet = props.rows.adSets.flatMap((row) => {
      const adSet = props.state.adSets.find((a) => a.id === row.id);
      const audience = adSet ? audienceById.get(adSet.audienceId) : undefined;
      if (!audience || row.t.impressions === 0) return [];
      return [breakdownFor(reportBy as BreakdownKind, row.t, audience, props.currentDay)];
    });
    return combineBreakdowns(perAdSet).map((r) => ({ key: r.key, t: r.t, reach: 0 }));
  }, [isBreakdown, props.rows.campaigns, props.rows.adSets, props.state, props.currentDay, reportBy]);

  const roas = props.totals.spend > 0 ? props.totals.revenue / props.totals.spend : 0;
  const costPerResult = props.totals.purchases > 0 ? Math.round(props.totals.spend / props.totals.purchases) : 0;
  const working = busy || pending;
  const atHorizon = props.maxDay !== undefined && props.currentDay >= props.maxDay;
  const frozen = Boolean(props.readOnly) || atHorizon;
  /** Never advance past a mission's horizon, so the grade measures the brief. */
  const daysLeft = props.maxDay !== undefined ? Math.max(0, props.maxDay - props.currentDay) : Infinity;

  function setRange(key: string) {
    setRangeOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('range', key);
    startTransition(() => router.replace(`${url.pathname}?${url.searchParams}`, { scroll: false }));
  }

  return (
    <div className="mb-shell">
      {(rangeOpen || columnsOpen) && (
        <div className="mb-backdrop" onClick={() => { setRangeOpen(false); setColumnsOpen(false); }} />
      )}

      <aside className="mb-side">
        <div className="mb-logo">
          <span className="mb-logo-mark" aria-hidden />
          {props.brandName}
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === nav ? 'mb-nav-item mb-nav-on' : 'mb-nav-item'}
              aria-current={item.key === nav ? 'page' : undefined}
              onClick={() => setNav(item.key)}
            >
              <span className="mb-nav-dot" aria-hidden />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="mb-main">
        <div className="mb-daybar">
          <div>
            <div className="mb-day-label">Day {props.currentDay}</div>
            <div className="mb-day-sub">
              {props.readOnly
                ? 'This run is closed. The numbers below are the record of it.'
                : atHorizon
                  ? 'The clock has run out for this mission.'
                  : props.currentDay === 0
                    ? 'Nothing has run yet. Advance the clock to see delivery.'
                    : `${props.currentDay} day${props.currentDay === 1 ? '' : 's'} of delivery so far`}
            </div>
          </div>
          {!frozen && (
            <div className="mb-daybar-actions">
              <button type="button" className="mb-btn" disabled={working} onClick={() => advance(1)}>
                <Play size={12} /> Advance a day
              </button>
              <button
                type="button"
                className="mb-btn-primary"
                disabled={working}
                onClick={() => advance(Math.min(7, daysLeft))}
              >
                {daysLeft < 7 ? `Advance ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'Advance a week'}
              </button>
            </div>
          )}
        </div>

        <div className="mb-topbar">
          <div>
            <h1>{LEVEL_TITLE[nav]}</h1>
            <p className="mb-breadcrumb">{props.brandName} · {props.brandCategory}</p>
          </div>
          <div className="mb-topbar-right">
            <span className="mb-sim-badge">Educational simulation</span>
            <div className="mb-range-wrap">
              <button type="button" className="mb-range" onClick={() => { setColumnsOpen(false); setRangeOpen((o) => !o); }}>
                {props.rangeLabel} <ChevronDown size={13} />
              </button>
              {rangeOpen && (
                <div className="mb-range-panel">
                  {RANGE_OPTIONS.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      className={props.rangeKey === r.key ? 'mb-range-opt mb-range-opt-on' : 'mb-range-opt'}
                      onClick={() => setRange(r.key)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <div className="mb-warn" role="alert"><b>Couldn&apos;t do that.</b> {error}</div>}
        {notice && !error && <div className="mb-warn" role="status">{notice}</div>}

        <div className="mb-kpis">
          <Kpi label="Amount spent" value={inr(props.totals.spend)} />
          <Kpi label="Purchase value" value={inr(props.totals.revenue)} />
          <Kpi label="Results" value={num(props.totals.purchases)} />
          <Kpi label="Cost per result" value={costPerResult > 0 ? inr(costPerResult) : '–'} />
          <Kpi label="Purchase ROAS" value={props.totals.spend > 0 ? `${roas.toFixed(2)}x` : '–'} />
        </div>

        <div className={working ? 'mb-busy' : undefined}>
          {DATA_LEVELS.has(nav) ? (
            <>
              <div className="mb-toolbar">
                <div className="mb-filters">
                  {FILTERS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={filter === f}
                      onClick={() => setFilter(f)}
                      className={filter === f ? 'mb-filter mb-filter-on' : 'mb-filter'}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="mb-actions">
                  <label className="mb-search">
                    <Search size={13} aria-hidden />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`Search ${LEVEL_TITLE[nav].toLowerCase()}`}
                      aria-label={`Search ${LEVEL_TITLE[nav].toLowerCase()}`}
                    />
                  </label>
                  {!frozen && (
                    <button
                      type="button"
                      className="mb-btn-primary"
                      disabled={working}
                      onClick={() => setCreating(nav === 'campaigns' ? 'campaign' : nav === 'adsets' ? 'adset' : 'ad')}
                    >
                      <Plus size={13} /> Create
                    </button>
                  )}
                  <div className="mb-cols-wrap">
                    <button type="button" className="mb-toolbtn" onClick={() => { setRangeOpen(false); setColumnsOpen((o) => !o); }}>
                      <SlidersHorizontal size={13} /> Columns
                    </button>
                    {columnsOpen && (
                      <div className="mb-cols-panel">
                        <div className="mb-cols-head">
                          <span>Customize columns</span>
                          <button type="button" className="mb-cols-reset" onClick={() => setEnabledColumns(DEFAULT_COLUMNS)}>
                            Reset to default
                          </button>
                        </div>
                        {(['Performance', 'Funnel'] as const).map((group) => (
                          <div key={group} className="mb-cols-group">
                            <div className="mb-cols-group-label">{group}</div>
                            {COLUMNS.filter((c) => c.group === group).map((c) => (
                              <label key={c.id} className="mb-cols-item">
                                <input
                                  type="checkbox"
                                  checked={enabledColumns.includes(c.id)}
                                  onChange={() => setEnabledColumns((prev) =>
                                    prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                                />
                                {c.label}
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="mb-empty">
                  {query.trim() ? `Nothing matches "${query.trim()}".` : 'Nothing here yet at this level.'}
                </p>
              ) : (
                <div className="mb-table-wrap">
                  <table className="mb-table">
                    <thead>
                      <tr>
                        <th aria-label="Delivery" />
                        <th>{LEVEL_NAME_HEADER[nav]}</th>
                        {visibleColumns.map((c) => (
                          <th key={c.id} className={c.numeric ? 'num' : undefined} aria-sort={
                            sort?.column === c.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                          }>
                            <button type="button" className="mb-sort" onClick={() => toggleSort(c.id)}>
                              {c.label}
                              {sort?.column === c.id && (
                                sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                              )}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        // Budgets are editable in place, but only at the level that
                        // actually owns them: a CBO campaign's ad sets show "Uses
                        // campaign budget" and offer nothing to click, which is the
                        // same constraint the server enforces.
                        const canEditBudget = row.budgetText.endsWith('/day');
                        if (editing?.id === row.id) {
                          return (
                            <tr key={row.id}>
                              <td />
                              <td><span className="mb-campaign-name">{row.name}</span></td>
                              <td colSpan={visibleColumns.length}>
                                <label>
                                  Daily budget ₹
                                  <input
                                    autoFocus
                                    type="number"
                                    min={1}
                                    value={editing.value}
                                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') commitBudget();
                                      if (e.key === 'Escape') setEditing(null);
                                    }}
                                    style={{ width: 110, marginLeft: 6, marginRight: 8 }}
                                  />
                                </label>
                                <button type="button" className="mb-btn-primary" onClick={commitBudget}>Save</button>
                                <button type="button" className="mb-btn" onClick={() => setEditing(null)} style={{ marginLeft: 6 }}>
                                  Cancel
                                </button>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <TableRow
                            key={row.id}
                            row={row}
                            columns={visibleColumns}
                            onToggle={frozen ? undefined : toggleStatus(nav === 'campaigns' ? 'campaign' : nav === 'adsets' ? 'adset' : 'ad')}
                            editableColumns={!frozen && canEditBudget && nav !== 'ads' ? EDITABLE_BUDGET : undefined}
                            onEditCell={(columnId, r) => {
                              if (columnId !== 'budget') return;
                              setEditing({
                                id: r.id,
                                level: nav === 'campaigns' ? 'campaign' : 'adset',
                                value: r.budgetText.replace(/[^\d]/g, ''),
                              });
                            }}
                          />
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td />
                        <td>Totals</td>
                        {visibleColumns.map((c) => (
                          <td key={c.id} className={c.numeric ? 'num' : undefined}>
                            {FOOTER_SKIP.has(c.id) ? '' : c.render(footerRow)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {DATA_LEVELS.has(nav) && rows.length > 0 && (
                <p className="mb-footnote">
                  Click a delivery switch to pause or resume. An underlined budget can be edited in
                  place; budgets shown as &ldquo;uses campaign budget&rdquo; are set on the campaign instead,
                  because that campaign uses Campaign Budget Optimization. Nothing moves until you
                  advance the clock.
                </p>
              )}
            </>
          ) : nav === 'audiences' ? (
            <AudiencesPanel
              rows={props.rows.audiences}
              footnote="Audience sizes are invented estimates for teaching, not real reach figures. Results and spend are summed across every ad set currently using that audience, for the selected range."
            />
          ) : (
            <>
              <ReportingPanel
                groups={reportGroups}
                breakdown={reportBy}
                onBreakdown={setReportBy}
                options={[
                  { key: 'filterType', label: 'By strategy' },
                  { key: 'delivery', label: 'By delivery' },
                  { key: 'age', label: 'By age' },
                  { key: 'gender', label: 'By gender' },
                  { key: 'placement', label: 'By placement' },
                ]}
              />
              {isBreakdown && (
                <p className="mb-footnote">
                  Age, gender and placement splits are modelled from each ad set&apos;s own targeting,
                  not measured per person: the simulator delivers at ad set level. They always add up
                  to the totals above, and they change when you change who you target, so they are
                  useful for reading audience mix. Treat them as a picture of your targeting rather
                  than as tracked demographics.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {creating && (
        <CreateFlow
          level={creating}
          state={props.state}
          busy={working}
          onCancel={() => setCreating(null)}
          onSubmit={(edits, describe) => void submitEdits(edits, describe)}
        />
      )}

      <AdsManagerStyles />

      {/* Rows sit above the click-catching backdrop so the budget editor stays usable. */}
      <style>{`
        .mb-table td label { font-size: 12.5px; color: var(--m-muted); }
        .mb-cell-edit {
          font: inherit; color: inherit; background: none; border: none; padding: 0;
          cursor: pointer; border-bottom: 1px dashed var(--m-faint);
        }
        .mb-cell-edit:hover { color: var(--m-blue); border-bottom-color: var(--m-blue); }
        .mb-table td input[type="number"] {
          font: inherit; padding: 4px 6px; border: 1px solid var(--m-line); border-radius: 6px;
        }
      `}</style>
    </div>
  );
}

