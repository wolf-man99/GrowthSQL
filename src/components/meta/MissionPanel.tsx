'use client';

import { useCallback, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ChevronDown, Lightbulb, XCircle } from 'lucide-react';
import { Card, Button } from '@/components/ui/primitives';
import { describeTarget, formatActual, type Mission, type MissionGrade } from '@/lib/simulator/missions';

/**
 * The brief that sits above a mission's account, and the debrief that replaces it.
 *
 * The brief stays visible the whole way through rather than being a modal shown
 * once: a learner mid-mission should never have to remember what they were asked
 * for, and hiding the objectives would turn a teaching exercise into a memory test.
 *
 * Hints are behind a disclosure. Someone who wants to work it out unaided can, and
 * someone genuinely stuck is better served by a nudge than by giving up. Neither
 * costs marks, because a hint used is still a lesson learned.
 */

export interface MissionPanelProps {
  mission: Pick<Mission, 'id' | 'title' | 'situation' | 'brief' | 'hints' | 'durationDays' | 'objectives' | 'debrief'>;
  accountId: string;
  currentDay: number;
  /** Set once the run has been graded. */
  grade?: MissionGrade | null;
}

export function MissionPanel({ mission, accountId, currentDay, grade }: MissionPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hintsOpen, setHintsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MissionGrade | null>(grade ?? null);

  const finished = currentDay >= mission.durationDays;

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/sim/mission', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'grade', missionId: mission.id, accountId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not grade this run.');
        return;
      }
      setResult(data.grade as MissionGrade);
      startTransition(() => router.refresh());
    } catch {
      setError('Network error. Your run is safe; nothing was graded.');
    } finally {
      setBusy(false);
    }
  }, [mission.id, accountId, router]);

  if (result) return <Debrief mission={mission} grade={result} />;

  const daysLeft = Math.max(0, mission.durationDays - currentDay);

  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="chip bg-[var(--blue)] text-white">Mission</span>
            <h2 className="text-lg font-extrabold">{mission.title}</h2>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-muted)]">{mission.situation}</p>
          <p className="mt-2 max-w-2xl text-sm font-semibold">{mission.brief}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-extrabold tabular-nums">
            {finished ? 'Day ' + currentDay : daysLeft}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
            {finished ? 'complete' : daysLeft === 1 ? 'day left' : 'days left'}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-1.5">
        {mission.objectives.map((o) => (
          <div key={o.id} className="flex items-start gap-2 text-[13px]">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--blue)]" />
            <span>
              {o.label}
              <span className="text-[var(--text-faint)]"> — {describeTarget(o)}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--text-muted)] hover:text-[var(--text)]"
          onClick={() => setHintsOpen((o) => !o)}
          aria-expanded={hintsOpen}
        >
          <Lightbulb size={13} /> {hintsOpen ? 'Hide hints' : `Hints (${mission.hints.length})`}
          <ChevronDown size={13} style={{ transform: hintsOpen ? 'rotate(180deg)' : undefined }} />
        </button>
        {hintsOpen && (
          <ul className="mt-2 grid gap-1.5 border-l-2 border-[var(--border)] pl-3">
            {mission.hints.map((h) => (
              <li key={h} className="text-[12.5px] text-[var(--text-muted)]">{h}</li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-[var(--danger)]" role="alert">{error}</p>}

      {finished && (
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submit} disabled={busy || pending}>See how you did</Button>
          <span className="text-xs text-[var(--text-muted)]">
            The clock has run out. Grading closes this account.
          </span>
        </div>
      )}
    </Card>
  );
}

function Debrief({
  mission, grade,
}: {
  mission: MissionPanelProps['mission'];
  grade: MissionGrade;
}) {
  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {grade.passed
            ? <CheckCircle2 size={22} className="text-[var(--green)]" />
            : <XCircle size={22} className="text-[var(--amber)]" />}
          <div>
            <h2 className="text-lg font-extrabold">
              {grade.passed ? 'Mission passed' : 'Not this time'}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              {mission.title} · {grade.score}% of objectives met
              {grade.xpAwarded > 0 ? ` · +${grade.xpAwarded} XP` : ''}
            </p>
          </div>
        </div>
        <Link href="/courses/meta-ads/run">
          <Button variant="secondary" size="sm"><ArrowLeft size={13} /> Back to missions</Button>
        </Link>
      </div>

      <div className="mt-4 grid gap-2">
        {grade.objectives.map((o) => (
          <div
            key={o.id}
            className="flex items-start justify-between gap-3 rounded-lg border-2 border-[var(--border)] p-3"
          >
            <div className="flex items-start gap-2">
              {o.passed
                ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[var(--green)]" />
                : <XCircle size={15} className="mt-0.5 shrink-0 text-[var(--danger)]" />}
              <div>
                <div className="text-[13.5px] font-bold">{o.label}</div>
                <div className="text-[12px] text-[var(--text-faint)]">
                  Needed {describeTarget({
                    id: o.id, label: o.label, metric: o.metric,
                    op: o.op, value: o.target, when: 'end',
                  })}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="mono text-[13px] font-bold tabular-nums">{formatActual(o)}</div>
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                you reached
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Shown regardless of the verdict: a learner who scraped a pass by luck needs
          the explanation just as much as one who missed. */}
      <div className="mt-4 rounded-lg bg-[var(--surface-2)] p-4">
        <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
          What this was teaching
        </div>
        <p className="text-sm leading-relaxed">{mission.debrief}</p>
      </div>
    </Card>
  );
}
