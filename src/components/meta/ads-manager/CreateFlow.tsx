'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { CREATIVES, CTA_OPTIONS } from '@/lib/simulator/creatives';
import { CreativeFrame } from './CreativeFrame';
import {
  OBJECTIVE_LABEL,
  type AdFormat,
  type BidStrategy,
  type BudgetMode,
  type Objective,
  type OptimisationEvent,
  type SimEdit,
  type SimState,
  type StrategyTag,
} from '@/lib/simulator/engine';

/**
 * Creating things: campaigns, ad sets, ads, and audiences.
 *
 * Structured as Meta structures it, because the structure *is* the lesson. A
 * campaign asks what you are optimising for and where the budget lives; an ad set
 * asks who you are reaching and what event you are buying; an ad asks what they
 * will actually see. A learner who builds a few of these has internalised the
 * hierarchy far better than one who read a diagram of it.
 *
 * Choices that carry a consequence in the model say so inline, in the language the
 * curriculum uses, rather than being silently correct or silently expensive. The
 * budget-mode hint is the clearest example: picking CBO for a set of untested
 * audiences is a real mistake, so the form names it at the moment of choosing.
 */

const OBJECTIVES: Objective[] = ['sales', 'leads', 'traffic', 'engagement', 'awareness', 'app_promotion'];
const STRATEGY_TAGS: { value: StrategyTag; label: string }[] = [
  { value: 'prospecting', label: 'Prospecting (cold)' },
  { value: 'retargeting', label: 'Retargeting (warm)' },
  { value: 'catalog', label: 'Catalog' },
];
const OPT_EVENTS: { value: OptimisationEvent; label: string; hint: string }[] = [
  { value: 'purchase', label: 'Purchase', hint: 'Rarest event, so hardest to reach 50 a week on a small budget.' },
  { value: 'add_to_cart', label: 'Add to cart', hint: 'Roughly 3x more frequent than purchases. The usual escape from Learning Limited.' },
  { value: 'landing_page_view', label: 'Landing page view', hint: 'Very frequent, but a weak signal of intent.' },
  { value: 'link_click', label: 'Link click', hint: 'Most frequent and weakest. Optimises for clickers, not buyers.' },
  { value: 'lead', label: 'Lead', hint: 'For lead-gen objectives rather than sales.' },
];

export type CreateLevel = 'campaign' | 'adset' | 'ad';

export interface CreateFlowProps {
  level: CreateLevel;
  state: SimState;
  busy: boolean;
  onCancel: () => void;
  /** Submits one or more edits in order; the parent posts them and refreshes. */
  onSubmit: (edits: SimEdit[], describe: string) => void;
}

/** Ids are generated client-side and validated server-side as fresh and well-formed. */
function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export function CreateFlow(props: CreateFlowProps) {
  const title =
    props.level === 'campaign' ? 'Create campaign'
    : props.level === 'adset' ? 'Create ad set'
    : 'Create ad';

  return (
    <div className="mb-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mb-modal">
        <div className="mb-modal-head">
          <h2>{title}</h2>
          <button type="button" className="mb-modal-x" onClick={props.onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="mb-modal-body">
          {props.level === 'campaign' && <CampaignForm {...props} />}
          {props.level === 'adset' && <AdSetForm {...props} />}
          {props.level === 'ad' && <AdForm {...props} />}
        </div>
      </div>
      <CreateFlowStyles />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── campaign ──

function CampaignForm({ state, busy, onCancel, onSubmit }: CreateFlowProps) {
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<Objective>('sales');
  const [strategyTag, setStrategyTag] = useState<StrategyTag>('prospecting');
  const [budgetMode, setBudgetMode] = useState<BudgetMode>('abo');
  const [dailyBudget, setDailyBudget] = useState('3000');
  const [bidStrategy, setBidStrategy] = useState<BidStrategy>('highest_volume');
  const [costCap, setCostCap] = useState('850');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Give the campaign a name.');
    const budget = Math.round(Number(dailyBudget));
    if (budgetMode === 'cbo' && (!Number.isFinite(budget) || budget < 50)) {
      return setError('A campaign budget needs a daily amount of at least ₹50.');
    }
    const cap = Math.round(Number(costCap));
    if (bidStrategy === 'cost_cap' && (!Number.isFinite(cap) || cap < 50)) {
      return setError('A cost cap needs a target cost per result.');
    }
    onSubmit([{
      kind: 'createCampaign',
      campaign: {
        id: newId('cmp'),
        name: name.trim(),
        objective,
        budgetMode,
        dailyBudget: budgetMode === 'cbo' ? budget : undefined,
        bidStrategy,
        costCap: bidStrategy === 'cost_cap' ? cap : undefined,
        strategyTag,
      },
    }], `Created campaign "${name.trim()}"`);
  }

  return (
    <form onSubmit={submit}>
      <Field label="Campaign name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prospecting · Winter drop" autoFocus />
      </Field>

      <Field label="Objective" hint="What you are asking Meta to go and find. Optimise for the outcome, not the vanity metric.">
        <select value={objective} onChange={(e) => setObjective(e.target.value as Objective)}>
          {OBJECTIVES.map((o) => <option key={o} value={o}>{OBJECTIVE_LABEL[o]}</option>)}
        </select>
      </Field>

      <Field label="Strategy" hint="Your own label for how this campaign is used. Drives the filters and reporting, not delivery.">
        <select value={strategyTag} onChange={(e) => setStrategyTag(e.target.value as StrategyTag)}>
          {STRATEGY_TAGS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>

      <Field label="Where the budget lives">
        <div className="mb-radio-row">
          <label>
            <input type="radio" checked={budgetMode === 'abo'} onChange={() => setBudgetMode('abo')} />
            <b>Ad set budgets</b>
            <span>You decide the split. Every ad set gets guaranteed spend, which is what makes a fair test possible.</span>
          </label>
          <label>
            <input type="radio" checked={budgetMode === 'cbo'} onChange={() => setBudgetMode('cbo')} />
            <b>Campaign budget</b>
            <span>Meta decides the split and concentrates on whatever wins early. Good for scaling proven ad sets, poor for testing new ones.</span>
          </label>
        </div>
      </Field>

      {budgetMode === 'cbo' && (
        <Field label="Daily campaign budget (₹)">
          <input type="number" min={50} value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
        </Field>
      )}

      <Field label="Bid strategy">
        <select value={bidStrategy} onChange={(e) => setBidStrategy(e.target.value as BidStrategy)}>
          <option value="highest_volume">Highest volume</option>
          <option value="cost_cap">Cost per result goal</option>
        </select>
      </Field>

      {bidStrategy === 'cost_cap' && (
        <Field label="Target cost per result (₹)" hint="Delivery holds back rather than buy above this, so volume is usually lower.">
          <input type="number" min={50} value={costCap} onChange={(e) => setCostCap(e.target.value)} />
        </Field>
      )}

      <Actions error={error} busy={busy} onCancel={onCancel} submitLabel="Create campaign" />
      {/* Named at the moment of choosing, because this is the mistake module 4.1 exists to prevent. */}
      {budgetMode === 'cbo' && state.campaigns.length > 0 && (
        <p className="mb-form-warn">
          Heads up: a campaign budget will starve untested ad sets before you learn anything from them.
          If these audiences are new, ad set budgets will give you a fair read first.
        </p>
      )}
    </form>
  );
}

// ──────────────────────────────────────────────────────────────── ad set ──

function AdSetForm({ state, busy, onCancel, onSubmit }: CreateFlowProps) {
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState(state.campaigns[0]?.id ?? '');
  const [audienceId, setAudienceId] = useState(state.audiences[0]?.id ?? '');
  const [dailyBudget, setDailyBudget] = useState('2000');
  const [optimisationEvent, setOptimisationEvent] = useState<OptimisationEvent>('purchase');
  const [advantagePlacements, setAdvantagePlacements] = useState(true);
  const [error, setError] = useState('');

  const parent = state.campaigns.find((c) => c.id === campaignId);
  const needsBudget = parent?.budgetMode === 'abo';
  const audience = state.audiences.find((a) => a.id === audienceId);

  // How many live ad sets already point at this pool. Overlap is invisible on a
  // real account until CPMs climb, so it is surfaced here before the mistake.
  const overlapping = useMemo(() => {
    if (!audience) return 0;
    const group = audience.overlapGroup ?? audience.id;
    return state.adSets.filter((a) => {
      if (a.status !== 'active') return false;
      const aud = state.audiences.find((x) => x.id === a.audienceId);
      return (aud?.overlapGroup ?? a.audienceId) === group;
    }).length;
  }, [audience, state.adSets, state.audiences]);

  const selectedEvent = OPT_EVENTS.find((e) => e.value === optimisationEvent);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Give the ad set a name.');
    if (!parent) return setError('Choose a campaign.');
    if (!audienceId) return setError('Choose an audience.');
    const budget = Math.round(Number(dailyBudget));
    if (needsBudget && (!Number.isFinite(budget) || budget < 50)) {
      return setError('This campaign uses ad set budgets, so give this one a daily amount.');
    }
    onSubmit([{
      kind: 'createAdSet',
      adSet: {
        id: newId('as'),
        campaignId,
        name: name.trim(),
        audienceId,
        dailyBudget: needsBudget ? budget : undefined,
        optimisationEvent,
        advantagePlacements,
      },
    }], `Created ad set "${name.trim()}"`);
  }

  return (
    <form onSubmit={submit}>
      <Field label="Ad set name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lookalike 3% · 18–34" autoFocus />
      </Field>

      <Field label="Campaign">
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          {state.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.budgetMode === 'cbo' ? 'campaign budget' : 'ad set budgets'})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Audience" hint="Who sees the ads. Narrower pools cost more per thousand impressions and saturate sooner.">
        <select value={audienceId} onChange={(e) => setAudienceId(e.target.value)}>
          {state.audiences.map((a) => (
            <option key={a.id} value={a.id}>{a.name} · {a.size.toLocaleString('en-IN')} people</option>
          ))}
        </select>
      </Field>

      {overlapping > 0 && (
        <p className="mb-form-warn">
          {overlapping} live ad set{overlapping > 1 ? 's' : ''} already {overlapping > 1 ? 'target' : 'targets'} this pool.
          Adding another means bidding against yourself, which raises everyone&apos;s CPM. Consider a fresh audience instead.
        </p>
      )}

      {needsBudget ? (
        <Field label="Daily budget (₹)" hint="Reaching ~50 optimisation events a week is what gets an ad set out of the learning phase.">
          <input type="number" min={50} value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
        </Field>
      ) : (
        <p className="mb-form-note">
          This campaign uses Campaign Budget Optimization, so Meta allocates spend across its ad sets.
          This ad set has no budget of its own.
        </p>
      )}

      <Field label="Optimise for" hint={selectedEvent?.hint}>
        <select value={optimisationEvent} onChange={(e) => setOptimisationEvent(e.target.value as OptimisationEvent)}>
          {OPT_EVENTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      <Field label="Placements">
        <label className="mb-check">
          <input type="checkbox" checked={advantagePlacements} onChange={(e) => setAdvantagePlacements(e.target.checked)} />
          Advantage+ placements (let Meta choose where to deliver)
        </label>
      </Field>

      <Actions error={error} busy={busy} onCancel={onCancel} submitLabel="Create ad set" />
    </form>
  );
}

// ───────────────────────────────────────────────────────────────────── ad ──

function AdForm({ state, busy, onCancel, onSubmit }: CreateFlowProps) {
  const [name, setName] = useState('');
  const [adSetId, setAdSetId] = useState(state.adSets[0]?.id ?? '');
  const [creativeId, setCreativeId] = useState(CREATIVES[0].id);
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [cta, setCta] = useState<string>(CTA_OPTIONS[0]);
  const [destinationUrl, setDestinationUrl] = useState('https://northbound.example/shop');
  const [error, setError] = useState('');

  const creative = CREATIVES.find((c) => c.id === creativeId)!;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Give the ad a name.');
    if (!adSetId) return setError('Choose an ad set.');
    onSubmit([{
      kind: 'createAd',
      ad: {
        id: newId('ad'),
        adSetId,
        name: name.trim(),
        creativeId,
        format: creative.format as AdFormat,
        primaryText,
        headline,
        description,
        cta,
        destinationUrl,
      },
    }], `Created ad "${name.trim()}"`);
  }

  return (
    <form onSubmit={submit}>
      <Field label="Ad name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="UGC · winter styling" autoFocus />
      </Field>

      <Field label="Ad set">
        <select value={adSetId} onChange={(e) => setAdSetId(e.target.value)}>
          {state.adSets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>

      <Field
        label="Creative"
        hint="Nothing here tells you how each one performs. That is the job: read it from the numbers once it runs."
      >
        <div className="mb-creative-picker">
          {CREATIVES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={c.id === creativeId ? 'mb-creative-opt mb-creative-on' : 'mb-creative-opt'}
              aria-pressed={c.id === creativeId}
              onClick={() => setCreativeId(c.id)}
            >
              <CreativeFrame creative={c} size={72} rounded={6} />
              <span className="mb-creative-opt-name">{c.name}</span>
              <span className="mb-creative-opt-fmt">{c.format}</span>
            </button>
          ))}
        </div>
      </Field>

      <p className="mb-form-note">{creative.concept}</p>

      <Field label="Primary text" hint="The body copy above the creative. Lead with the hook, not the brand name.">
        <textarea rows={3} value={primaryText} onChange={(e) => setPrimaryText(e.target.value)}
          placeholder="Three pieces, styled three ways. Free returns within 30 days." />
      </Field>

      <Field label="Headline">
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="The everyday tee" maxLength={200} />
      </Field>

      <Field label="Description">
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ships in 48 hours" maxLength={400} />
      </Field>

      <Field label="Call to action">
        <select value={cta} onChange={(e) => setCta(e.target.value)}>
          {CTA_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Destination URL">
        <input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} />
      </Field>

      <Actions error={error} busy={busy} onCancel={onCancel} submitLabel="Create ad" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────── plumbing ──

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="mb-field">
      <span className="mb-field-label">{label}</span>
      {children}
      {hint && <span className="mb-field-hint">{hint}</span>}
    </label>
  );
}

function Actions({
  error, busy, onCancel, submitLabel,
}: {
  error: string; busy: boolean; onCancel: () => void; submitLabel: string;
}) {
  return (
    <>
      {error && <p className="mb-form-error" role="alert">{error}</p>}
      <div className="mb-modal-actions">
        <button type="button" className="mb-btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="mb-btn-primary" disabled={busy}>{submitLabel}</button>
      </div>
    </>
  );
}

function CreateFlowStyles() {
  return (
    <style>{`
      .mb-modal-backdrop {
        position: fixed; inset: 0; z-index: 60; display: grid; place-items: center;
        background: rgba(0,0,0,0.45); padding: 20px;
      }
      .mb-modal {
        background: var(--m-card, #fff); color: var(--m-ink, #1c1e21);
        border-radius: 12px; width: min(620px, 100%); max-height: 88vh;
        display: flex; flex-direction: column; overflow: hidden;
        font-family: "Segoe UI", -apple-system, Roboto, Helvetica, Arial, sans-serif;
        box-shadow: 0 12px 40px rgba(0,0,0,0.28);
      }
      .mb-modal-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; border-bottom: 1px solid var(--m-line, #dadde1);
      }
      .mb-modal-head h2 { margin: 0; font-size: 16px; font-weight: 700; }
      .mb-modal-x {
        border: none; background: none; cursor: pointer; color: var(--m-muted, #65676b);
        display: grid; place-items: center; padding: 4px; border-radius: 6px;
      }
      .mb-modal-x:hover { background: #f2f3f5; }
      .mb-modal-body { padding: 16px 18px 18px; overflow-y: auto; }

      .mb-field { display: block; margin-bottom: 14px; }
      .mb-field-label { display: block; font-size: 12.5px; font-weight: 700; margin-bottom: 5px; }
      .mb-field input[type="text"], .mb-field input:not([type]), .mb-field input[type="number"],
      .mb-field select, .mb-field textarea {
        width: 100%; font: inherit; font-size: 13px; padding: 8px 10px;
        border: 1px solid var(--m-line, #dadde1); border-radius: 6px; background: #fff;
        color: inherit;
      }
      .mb-field textarea { resize: vertical; }
      .mb-field-hint { display: block; font-size: 11.5px; color: var(--m-muted, #65676b); margin-top: 5px; }

      .mb-radio-row { display: grid; gap: 8px; }
      .mb-radio-row label {
        display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; align-items: start;
        border: 1px solid var(--m-line, #dadde1); border-radius: 8px; padding: 10px 12px; cursor: pointer;
      }
      .mb-radio-row label:has(input:checked) { border-color: var(--m-blue, #1877f2); background: var(--m-blue-soft, #e7f0ff); }
      .mb-radio-row input { margin-top: 2px; }
      .mb-radio-row b { font-size: 13px; }
      .mb-radio-row span { grid-column: 2; font-size: 11.5px; color: var(--m-muted, #65676b); }

      .mb-check { display: flex; align-items: center; gap: 8px; font-size: 13px; }
      .mb-check input { margin: 0; }

      .mb-creative-picker {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px;
        max-height: 260px; overflow-y: auto; padding: 2px;
      }
      .mb-creative-opt {
        display: grid; justify-items: center; gap: 4px; padding: 6px;
        border: 1px solid var(--m-line, #dadde1); border-radius: 8px; background: #fff; cursor: pointer;
      }
      .mb-creative-opt:hover { border-color: var(--m-blue, #1877f2); }
      .mb-creative-on { border-color: var(--m-blue, #1877f2); background: var(--m-blue-soft, #e7f0ff); }
      .mb-creative-opt-name { font-size: 10.5px; font-weight: 600; text-align: center; line-height: 1.25; }
      .mb-creative-opt-fmt { font-size: 10px; color: var(--m-muted, #65676b); text-transform: capitalize; }

      .mb-form-note {
        font-size: 11.5px; color: var(--m-muted, #65676b); margin: -6px 0 14px;
        padding: 8px 10px; background: #f5f6f7; border-radius: 6px;
      }
      .mb-form-warn {
        font-size: 11.5px; color: #7a5b00; margin: -6px 0 14px;
        padding: 8px 10px; background: #fdf6e3; border: 1px solid #f0c36d; border-radius: 6px;
      }
      .mb-form-error {
        font-size: 12px; color: #b3261e; margin: 0 0 10px;
        padding: 8px 10px; background: #fbeae9; border-radius: 6px;
      }
      .mb-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
    `}</style>
  );
}
