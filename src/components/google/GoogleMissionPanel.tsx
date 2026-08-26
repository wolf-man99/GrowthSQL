'use client';

/**
 * The mission brief, live above the account, and the debrief that closes it.
 *
 * Objectives stay on screen the whole way through rather than being hidden behind
 * a button. A learner should be able to hold the goal and the numbers in view at
 * the same time — that is the entire skill being practised, and putting the goal
 * one click away turns it into a memory exercise instead.
 *
 * The debrief is written before anybody plays and shows whether they passed or
 * failed, because the mechanism is the teaching and a lucky pass needs it as much
 * as a loss does.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import type { GMissionGrade } from '@/lib/gsim/missions/types';

export interface MissionBrief {
  id: string;
  title: string;
  situation: string;
  brief: string;
  hints: string[];
  durationDays: number;
  xp: number;
  objectives: { id: string; label: string; why?: string }[];
}

export function GoogleMissionPanel({
  mission, accountId, currentDay, initialGrade,
}: {
  mission: MissionBrief;
  accountId: string;
  currentDay: number;
  /** Set when the mission has already been graded, so a revisit shows the result
   *  rather than offering to grade an account that is already closed. */
  initialGrade: GMissionGrade | null;
}) {
  const router = useRouter();
  const [grade, setGrade] = useState<GMissionGrade | null>(initialGrade);
  const [xp, setXp] = useState<number | null>(null);
  const [debrief, setDebrief] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysLeft = Math.max(0, mission.durationDays - currentDay);
  const finished = daysLeft === 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/gsim/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'grade', missionId: mission.id, accountId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not grade the mission.');
      setGrade(json.grade as GMissionGrade);
      setXp(json.xpAwarded as number);
      setDebrief(json.debrief as string);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not grade the mission.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
            Mission · {mission.xp} XP
          </p>
          <h2 className="mt-0.5 text-xl font-extrabold tracking-tight">{mission.title}</h2>
        </div>
        <span className="chip bg-[var(--ink)] text-white">
          {finished ? 'Run complete' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{mission.situation}</p>
      <p className="mt-2 text-sm leading-relaxed">{mission.brief}</p>

      <div className="mt-4 grid gap-2">
        {mission.objectives.map((o) => {
          const result = grade?.objectives.find((r) => r.id === o.id);
          return (
            <div
              key={o.id}
              className="flex items-start gap-2.5 rounded-lg border-2 border-[var(--line)] px-3 py-2.5"
            >
              <span className="mt-0.5 shrink-0">
                {result
                  ? (result.passed
                    ? <CheckCircle2 size={15} className="text-[var(--green)]" />
                    : <XCircle size={15} className="text-[var(--red)]" />)
                  : <span className="block h-[15px] w-[15px] rounded-full border-2 border-[var(--line)]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{o.label}</span>
                {result ? (
                  <span className="mt-0.5 block text-xs font-bold text-[var(--text-muted)]">
                    Reached {formatMetric(result.metric, result.actual)}
                    {' · needed '}
                    {result.op === 'gte' ? 'at least ' : 'at most '}
                    {formatMetric(result.metric, result.target)}
                  </span>
                ) : o.why ? (
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-muted)]">
                    {o.why}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border-2 border-[var(--red)] bg-[var(--red)]/10 px-3 py-2 text-sm font-semibold">
          {error}
        </p>
      ) : null}

      {grade ? (
        <div className="mt-5 rounded-xl border-2 border-[var(--ink)] bg-[var(--card)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${grade.passed ? 'bg-[var(--green)]' : 'bg-[var(--red)]'} text-white`}>
              {grade.passed ? 'Passed' : 'Not this time'}
            </span>
            <span className="text-sm font-extrabold">
              {grade.met} of {grade.total} objectives · {grade.score}%
            </span>
            {xp !== null && xp > 0 ? (
              <span className="text-sm font-bold text-[var(--green)]">+{xp} XP</span>
            ) : null}
          </div>

          {debrief ? (
            <div className="mt-3 space-y-3">
              {debrief.split('\n\n').map((para) => (
                <p key={para.slice(0, 40)} className="text-sm leading-relaxed">{para}</p>
              ))}
            </div>
          ) : null}

          <Link
            href="/courses/google-ads/run"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border-2 border-[var(--ink)] bg-[var(--ink)] px-3.5 py-2 text-sm font-bold text-white shadow-[3px_3px_0_var(--ink)]"
          >
            Back to missions
          </Link>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !finished}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[var(--ink)] bg-[var(--ink)] px-3.5 py-2 text-sm font-bold text-white shadow-[3px_3px_0_var(--ink)] disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            Finish and grade
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            {finished
              ? 'The run is over. Grading closes the account.'
              : `Advance the clock to day ${mission.durationDays} first.`}
          </span>
        </div>
      )}
    </Card>
  );
}

/** Formats a measured value the way its own metric is normally written, so
 *  "reached 0.42" never appears where "reached 42%" is what a learner would say. */
function formatMetric(metric: string, value: number): string {
  if (!Number.isFinite(value)) return '—';
  switch (metric) {
    case 'roas':
      return `${value.toFixed(2)}×`;
    case 'ctr':
    case 'lostToBudgetShare':
    case 'lostToRankShare':
    case 'brandImpressionShare':
    case 'appActivation':
      return `${(value * 100).toFixed(1)}%`;
    case 'cpa':
    case 'cost':
    case 'cpc':
    case 'appCostPerEvent':
      return `₹${Math.round(value).toLocaleString('en-IN')}`;
    case 'avgQualityScore':
      return `${value.toFixed(1)}/10`;
    default:
      return Math.round(value).toLocaleString('en-IN');
  }
}
