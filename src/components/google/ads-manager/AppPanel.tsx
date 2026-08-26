'use client';

/**
 * An App campaign's workspace.
 *
 * Built around the one comparison the campaign type exists to teach: cost per
 * install next to cost per in-app action, side by side, on every row. Every app
 * team in the world reports the first number and manages to it, and the channel
 * table underneath shows exactly why that goes wrong — the cheapest installs come
 * from the inventory whose installs never do anything.
 *
 * There is no placement control here because Google does not offer one. That is a
 * fact about the product and the panel says it rather than quietly omitting it,
 * because "you cannot choose, you can only change what you ask for" is the single
 * most important thing to understand about App campaigns.
 */

import { count, inr, pct } from '@/lib/gsim/view';
import type { AppChannelTotals } from '@/lib/gsim/view';
import type { AppDayResult, GCampaign } from '@/lib/gsim/engine/types';
import { APP_GOAL_LABEL, type AppSettings } from '@/lib/gsim/engine/app';
import { Empty, Kpi } from './shared';

export type AppTab = 'channels' | 'assets' | 'settings';

export const APP_TABS: { id: AppTab; label: string }[] = [
  { id: 'channels', label: 'Where it ran' },
  { id: 'assets', label: 'Assets' },
  { id: 'settings', label: 'Goal & bidding' },
];

interface Props {
  tab: AppTab;
  campaign: GCampaign;
  app: AppSettings;
  totals: AppDayResult;
  channels: AppChannelTotals[];
  /** The most a customer may cost before the campaign stops being worth running. */
  ceiling: number;
  busy: boolean;
  onSetGoal: (goal: AppSettings['goal']) => void;
  onEditTarget: (anchor: DOMRect) => void;
  onEditAssets: (kind: 'images' | 'videos', anchor: DOMRect) => void;
}

const cpi = (r: { cost: number; installs: number }) => (r.installs > 0 ? r.cost / r.installs : 0);
const cpe = (r: { cost: number; events: number }) => (r.events > 0 ? r.cost / r.events : 0);

export function AppPanel(props: Props) {
  if (props.totals.blocked) {
    return (
      <>
        <div className="ga-note ga-note-red">
          <b>Not delivering.</b> {props.totals.blocked}
        </div>
        {props.tab === 'settings' ? <SettingsTab {...props} /> : <AssetsTab {...props} />}
      </>
    );
  }
  switch (props.tab) {
    case 'channels': return <ChannelsTab {...props} />;
    case 'assets': return <AssetsTab {...props} />;
    case 'settings': return <SettingsTab {...props} />;
  }
}

// ─────────────────────────────────────────────────────────────── channels ──

function ChannelsTab({ totals, channels, app, ceiling }: Props) {
  if (channels.length === 0) {
    return <Empty title="No delivery yet">Advance a few days to see where this campaign ran.</Empty>;
  }

  const installCost = cpi(totals);
  const customerCost = cpe(totals);
  const overCeiling = customerCost > ceiling;

  return (
    <>
      <div className="ga-kpis">
        <Kpi label="Installs" value={count(totals.installs)} />
        <Kpi label="Cost per install" value={inr(installCost)} note="the number on the deck" />
        <Kpi label={app.eventName} value={count(totals.events)} />
        <Kpi
          label={`Cost per ${app.eventName.toLowerCase()}`}
          value={totals.events > 0 ? inr(customerCost) : '—'}
          note={`ceiling ${inr(ceiling)}`}
          tone={totals.events > 0 ? (overCeiling ? 'bad' : 'good') : undefined}
        />
        <Kpi
          label="Activation"
          value={pct(totals.installs > 0 ? totals.events / totals.installs : 0, 1)}
          note="installs that did the thing"
        />
      </div>

      {overCeiling ? (
        <div className="ga-note ga-note-red">
          Every {app.eventName.toLowerCase()} is costing <b>{inr(customerCost)}</b> against a
          ceiling of <b>{inr(ceiling)}</b>. The cost per install looks fine. It is not the
          number that decides whether this campaign makes money.
        </div>
      ) : (
        <div className="ga-note">
          Read the two cost columns together. The channels selling the cheapest installs
          are the ones whose installs are least likely to ever do anything.
        </div>
      )}

      <div className="ga-tablewrap">
        <table className="ga-table">
          <thead>
            <tr>
              <th>Where it ran</th>
              <th className="num">Cost</th>
              <th className="num">Installs</th>
              <th className="num">Cost / install</th>
              <th className="num">{app.eventName}</th>
              <th className="num">Cost / {app.eventName.toLowerCase()}</th>
              <th className="num">Activation</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => {
              const perEvent = cpe(c);
              const bad = c.events === 0 || perEvent > ceiling;
              return (
                <tr key={c.channelId}>
                  <td className="ga-name">{c.label}</td>
                  <td className="num">{inr(c.cost)}</td>
                  <td className="num">{count(c.installs)}</td>
                  <td className="num">{inr(cpi(c))}</td>
                  <td className="num">{count(c.events)}</td>
                  <td className="num" style={{ color: bad ? 'var(--g-red)' : 'var(--g-green)', fontWeight: 500 }}>
                    {c.events > 0 ? inr(perEvent) : '—'}
                  </td>
                  <td className="num">{pct(c.installs > 0 ? c.events / c.installs : 0, 1)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="num">{inr(totals.cost)}</td>
              <td className="num">{count(totals.installs)}</td>
              <td className="num">{inr(installCost)}</td>
              <td className="num">{count(totals.events)}</td>
              <td className="num">{totals.events > 0 ? inr(customerCost) : '—'}</td>
              <td className="num">{pct(totals.installs > 0 ? totals.events / totals.installs : 0, 1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--g-muted)', marginTop: 10, lineHeight: 1.55 }}>
        You cannot choose these. An App campaign decides where to run based on what you
        asked it to optimise for — change the goal, and the mix changes with it.
      </p>
    </>
  );
}

// ───────────────────────────────────────────────────────────────── assets ──

const REQUIREMENTS = [
  { kind: 'Text', note: 'Search and Google Play. Without it, nothing runs at all.' },
  { kind: 'Images', note: 'Display and Discover — the cheap, high-volume inventory.' },
  { kind: 'Video', note: 'YouTube. Without video, that inventory simply is not available.' },
];

function AssetsTab({ app, busy, onEditAssets }: Props) {
  const have = {
    Text: app.assets.headlines + app.assets.descriptions,
    Images: app.assets.images,
    Video: app.assets.videos,
  } as Record<string, number>;

  return (
    <>
      <div className="ga-note">
        Assets are not decoration here — they are which half of the internet the campaign
        is allowed to run on. A missing format is a missing channel, and the interface
        will not tell you that is why your volume is low.
      </div>
      <div className="ga-tablewrap">
        <table className="ga-table">
          <thead>
            <tr>
              <th>Asset type</th>
              <th className="num">Count</th>
              <th>What it unlocks</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {REQUIREMENTS.map((r) => (
              <tr key={r.kind}>
                <td className="ga-name">
                  <span className={`ga-dot ${have[r.kind] > 0 ? 'ga-dot-ok' : 'ga-dot-bad'}`} />
                  {r.kind}
                </td>
                <td className="num">{have[r.kind]}</td>
                <td style={{ color: 'var(--g-muted)' }}>{r.note}</td>
                <td>
                  {r.kind === 'Text' ? null : (
                    <button
                      type="button"
                      className="ga-linky"
                      disabled={busy}
                      onClick={(e) => onEditAssets(
                        r.kind === 'Images' ? 'images' : 'videos',
                        e.currentTarget.getBoundingClientRect(),
                      )}
                    >
                      Change
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────── settings ──

const GOAL_NOTE: Record<AppSettings['goal'], string> = {
  installs:
    'Buys the cheapest installs it can find. It will find them, and they will come from '
    + 'the inventory least likely to produce a customer.',
  in_app_action:
    'Buys the people most likely to do the thing. Far fewer installs, several times the '
    + 'reported cost per install, and a better business.',
  roas:
    'The same, weighted by what each action is worth. Needs enough conversion history to '
    + 'have an opinion worth acting on.',
};

function SettingsTab({ campaign, app, ceiling, busy, onSetGoal, onEditTarget }: Props) {
  return (
    <>
      <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>What this campaign is optimising for</h3>
      <p style={{ fontSize: 12.5, color: 'var(--g-muted)', margin: '0 0 12px', lineHeight: 1.55 }}>
        The only real lever an App campaign has. It does not change where the ads can
        run — it changes which of those places the money goes to.
      </p>

      <div className="ga-chips">
        {(Object.keys(APP_GOAL_LABEL) as AppSettings['goal'][]).map((g) => (
          <button
            key={g}
            type="button"
            className={app.goal === g ? 'ga-chip ga-chip-on' : 'ga-chip'}
            disabled={busy}
            onClick={() => onSetGoal(g)}
          >
            {APP_GOAL_LABEL[g]}
          </button>
        ))}
      </div>

      <div className="ga-note">{GOAL_NOTE[app.goal]}</div>

      <div className="ga-tablewrap">
        <table className="ga-table">
          <tbody>
            <tr>
              <td style={{ width: 220, color: 'var(--g-muted)' }}>Daily budget</td>
              <td className="ga-name">{inr(campaign.dailyBudget)}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--g-muted)' }}>
                {app.goal === 'installs' ? 'Target cost per install'
                  : app.goal === 'roas' ? 'Target return on ad spend'
                    : `Target cost per ${app.eventName.toLowerCase()}`}
              </td>
              <td>
                <button
                  type="button"
                  className="ga-cell-edit ga-name"
                  disabled={busy}
                  onClick={(e) => onEditTarget(e.currentTarget.getBoundingClientRect())}
                  aria-label="Edit target"
                >
                  {app.goal === 'installs' ? inr(app.targetCpi ?? 0)
                    : app.goal === 'roas' ? `${Math.round((app.targetRoas ?? 1) * 100)}%`
                      : inr(app.targetEventCpa ?? 0)}
                </button>
              </td>
            </tr>
            <tr>
              <td style={{ color: 'var(--g-muted)' }}>
                {app.eventName}
                <span className="ga-sub">what the business actually sells</span>
              </td>
              <td className="ga-name">
                {inr(app.eventValue)} each · at most {inr(ceiling)} to acquire
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--g-muted)', marginTop: 12, lineHeight: 1.55 }}>
        A target no channel can meet does not produce a miracle. It produces a campaign
        that stops delivering, and an interface that does not go out of its way to say so.
      </p>
    </>
  );
}
