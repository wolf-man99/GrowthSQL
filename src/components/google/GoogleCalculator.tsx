'use client';

import { useState } from 'react';
import type { GCalcVariant } from '@/lib/content/google-ads/types';

/**
 * Interactive calculators for the Google Ads course.
 *
 * Each one exists because the lesson beside it makes a claim that is far more
 * convincing when the learner moves the numbers themselves. "Quality Score divides
 * your CPC" is a sentence; watching the CPC halve while the bid stays put is an
 * argument.
 *
 * Same shell and controls as the Meta course's calculators — deliberately, so the
 * interaction is already familiar to anyone arriving from that course — but the
 * maths is Search's own.
 */
export function GoogleCalculator({ variant }: { variant: GCalcVariant }) {
  if (variant === 'ad-rank') return <AdRankCalc />;
  if (variant === 'breakeven-cpc') return <BreakevenCpcCalc />;
  if (variant === 'target-cpa') return <TargetCalc />;
  if (variant === 'click-value') return <ClickValueCalc />;
  return <BudgetHeadroomCalc />;
}

/* ─── Shared controls ──────────────────────────────────────────────────────── */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function Num({
  value, onChange, prefix, suffix, step = 1, min,
}: {
  value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; step?: number; min?: number;
}) {
  return (
    <span className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-1">
      {prefix && <span className="text-xs text-[var(--text-faint)]">{prefix}</span>}
      <input
        type="number" value={value} step={step} min={min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 bg-transparent text-right text-sm outline-none tabular-nums"
      />
      {suffix && <span className="text-xs text-[var(--text-faint)]">{suffix}</span>}
    </span>
  );
}

function Result({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-subtle)]">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums" style={{ color: tone }}>{value}</div>
    </div>
  );
}

function Shell({ children, results, note }: { children: React.ReactNode; results: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="divide-y divide-[var(--border)]">{children}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">{results}</div>
      {note && <p className="mt-2.5 text-xs leading-relaxed text-[var(--text-subtle)]">{note}</p>}
    </div>
  );
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const GREEN = 'var(--green)';
const RED = 'var(--danger)';

/* ─── Ad Rank ──────────────────────────────────────────────────────────────── */

/**
 * Two advertisers, and what the winner actually pays.
 *
 * The second-price formula is the part worth showing: CPC is the rank below you
 * divided by your own Quality Score. Raise the bid and the CPC does not move;
 * raise Quality Score and it falls. Reading that is one thing, watching the loser
 * become the winner while bidding less is another.
 */
function AdRankCalc() {
  const [bidA, setBidA] = useState(40);
  const [qsA, setQsA] = useState(4);
  const [bidB, setBidB] = useState(25);
  const [qsB, setQsB] = useState(9);

  const rankA = bidA * qsA;
  const rankB = bidB * qsB;
  const aWins = rankA >= rankB;

  // Second price: pay just enough to hold position against the ad below.
  const winnerQs = aWins ? qsA : qsB;
  const loserRank = aWins ? rankB : rankA;
  const winnerBid = aWins ? bidA : bidB;
  const cpc = winnerQs > 0 ? Math.min(winnerBid, loserRank / winnerQs + 0.01) : winnerBid;

  return (
    <Shell
      results={
        <>
          <Result label="Advertiser A rank" value={rankA.toFixed(0)} tone={aWins ? GREEN : undefined} />
          <Result label="Advertiser B rank" value={rankB.toFixed(0)} tone={aWins ? undefined : GREEN} />
          <Result label="Winner" value={aWins ? 'A' : 'B'} tone={GREEN} />
          <Result label="Winner actually pays" value={inr(cpc)} tone={GREEN} />
        </>
      }
      note={`The winner never pays their full bid — only enough to hold position against the ad below. Push the winner's bid up and the CPC barely moves; push their Quality Score up and it falls, because Quality Score is the divisor.`}
    >
      <Row label="A: max CPC"><Num value={bidA} onChange={setBidA} prefix="₹" /></Row>
      <Row label="A: Quality Score"><Num value={qsA} onChange={setQsA} min={1} suffix="/10" /></Row>
      <Row label="B: max CPC"><Num value={bidB} onChange={setBidB} prefix="₹" /></Row>
      <Row label="B: Quality Score"><Num value={qsB} onChange={setQsB} min={1} suffix="/10" /></Row>
    </Shell>
  );
}

/* ─── Break-even CPC ───────────────────────────────────────────────────────── */

/** Margin and conversion rate set the highest click price that still makes money. */
function BreakevenCpcCalc() {
  const [aov, setAov] = useState(2000);
  const [margin, setMargin] = useState(40);
  const [cvr, setCvr] = useState(3);

  const profitPerOrder = aov * (margin / 100);
  const breakevenCpc = profitPerOrder * (cvr / 100);
  const breakevenRoas = margin > 0 ? 100 / margin : 0;

  return (
    <Shell
      results={
        <>
          <Result label="Profit per order" value={inr(profitPerOrder)} />
          <Result label="Break-even ROAS" value={`${breakevenRoas.toFixed(2)}x`} />
          <Result label="Break-even CPC" value={inr(breakevenCpc)} tone={GREEN} />
          <Result label="Target CPC (70%)" value={inr(breakevenCpc * 0.7)} tone={GREEN} />
        </>
      }
      note="Break-even CPC is the point where a click costs exactly what it earns. Bid there and you work for nothing, so aim below it — around 70% leaves room for the days that underperform."
    >
      <Row label="Average order value"><Num value={aov} onChange={setAov} prefix="₹" step={100} /></Row>
      <Row label="Gross margin"><Num value={margin} onChange={setMargin} suffix="%" /></Row>
      <Row label="Conversion rate"><Num value={cvr} onChange={setCvr} suffix="%" step={0.1} /></Row>
    </Shell>
  );
}

/* ─── Target CPA / tROAS ───────────────────────────────────────────────────── */

/**
 * The same economics, expressed as both bidding targets.
 *
 * Google asks for one number and learners usually copy their current CPA into it,
 * which just asks the algorithm to reproduce today. Deriving it from margin instead
 * is what turns the target into a decision.
 */
function TargetCalc() {
  const [aov, setAov] = useState(2000);
  const [margin, setMargin] = useState(40);
  const [keep, setKeep] = useState(30);

  const profitPerOrder = aov * (margin / 100);
  const targetCpa = profitPerOrder * (1 - keep / 100);
  const targetRoas = targetCpa > 0 ? (aov / targetCpa) * 100 : 0;
  const breakevenRoas = margin > 0 ? 100 / margin : 0;

  return (
    <Shell
      results={
        <>
          <Result label="Profit per order" value={inr(profitPerOrder)} />
          <Result label="Break-even ROAS" value={`${breakevenRoas.toFixed(2)}x`} tone={RED} />
          <Result label="Target CPA" value={inr(targetCpa)} tone={GREEN} />
          <Result label="Target ROAS" value={`${(targetRoas / 100).toFixed(2)}x`} tone={GREEN} />
        </>
      }
      note="Break-even ROAS is the floor: below it, more volume loses money faster. The target sits above it by however much profit you want to keep per sale. Keeping less buys more volume — which is usually the right trade until you reach the floor."
    >
      <Row label="Average order value"><Num value={aov} onChange={setAov} prefix="₹" step={100} /></Row>
      <Row label="Gross margin"><Num value={margin} onChange={setMargin} suffix="%" /></Row>
      <Row label="Profit to keep per sale"><Num value={keep} onChange={setKeep} suffix="%" /></Row>
    </Shell>
  );
}

/* ─── Click value ──────────────────────────────────────────────────────────── */

/** What a click is worth, before you decide what to bid for one. */
function ClickValueCalc() {
  const [cvr, setCvr] = useState(3);
  const [aov, setAov] = useState(2000);
  const [cpc, setCpc] = useState(45);

  const revenuePerClick = aov * (cvr / 100);
  const profitPerClick = revenuePerClick - cpc;
  const roas = cpc > 0 ? revenuePerClick / cpc : 0;
  const cpa = cvr > 0 ? cpc / (cvr / 100) : 0;

  return (
    <Shell
      results={
        <>
          <Result label="Revenue per click" value={inr(revenuePerClick)} />
          <Result label="Cost per acquisition" value={inr(cpa)} />
          <Result label="ROAS" value={`${roas.toFixed(2)}x`} tone={roas >= 1 ? GREEN : RED} />
          <Result
            label="Profit per click"
            value={inr(profitPerClick)}
            tone={profitPerClick >= 0 ? GREEN : RED}
          />
        </>
      }
      note="Every click has an expected value whether or not it converts. One in thirty buying at ₹2,000 makes each click worth about ₹67 in revenue — so ₹45 is a real bid and ₹80 is not, regardless of what the auction is asking."
    >
      <Row label="Conversion rate"><Num value={cvr} onChange={setCvr} suffix="%" step={0.1} /></Row>
      <Row label="Average order value"><Num value={aov} onChange={setAov} prefix="₹" step={100} /></Row>
      <Row label="Cost per click"><Num value={cpc} onChange={setCpc} prefix="₹" /></Row>
    </Shell>
  );
}

/* ─── Budget headroom ──────────────────────────────────────────────────────── */

/**
 * How much bigger a budget-limited campaign could be.
 *
 * Impression share lost to budget is the only figure in the account that names
 * demand you are provably not buying. This turns it into a rupee number, which is
 * a far easier thing to take to whoever approves the budget.
 */
function BudgetHeadroomCalc() {
  const [spend, setSpend] = useState(1000);
  const [lostToBudget, setLostToBudget] = useState(65);
  const [roas, setRoas] = useState(3.2);

  const captured = Math.max(1, 100 - lostToBudget);
  const fullSpend = spend * (100 / captured);
  const extraSpend = fullSpend - spend;
  const extraRevenue = extraSpend * roas;

  return (
    <Shell
      results={
        <>
          <Result label="Uncapped daily spend" value={inr(fullSpend)} />
          <Result label="Daily headroom" value={inr(extraSpend)} tone={GREEN} />
          <Result label="Revenue left on table" value={inr(extraRevenue)} tone={GREEN} />
          <Result label="Per month" value={inr(extraRevenue * 30)} tone={GREEN} />
        </>
      }
      note="Assumes the extra impressions convert like the ones you already win, which is optimistic — the auctions you lose to budget are not a random sample. Treat it as an upper bound and raise the budget in 20–30% steps rather than jumping straight there."
    >
      <Row label="Current daily spend"><Num value={spend} onChange={setSpend} prefix="₹" step={100} /></Row>
      <Row label="Impr. share lost to budget"><Num value={lostToBudget} onChange={setLostToBudget} suffix="%" /></Row>
      <Row label="Current ROAS"><Num value={roas} onChange={setRoas} suffix="x" step={0.1} /></Row>
    </Shell>
  );
}
