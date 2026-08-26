'use client';

/**
 * The mission list.
 *
 * Every mission shows its objectives before it is started, which is deliberate.
 * A brief that hides what it will be graded on turns the exercise into guessing
 * what the marker wants; showing the numbers up front makes it what it should be —
 * a problem with a stated goal, where the difficulty is working out how to reach
 * it rather than what "it" is.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, Loader2, Lock, PlayCircle, RotateCcw, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import type { GMissionStatus } from '@/lib/gsim/missions/progress';

/** Only the fields that survive the server boundary — a `GMission` carries
 *  `buildState()`, which is a function and cannot be serialised. */
export interface MissionCard {
  id: string;
  moduleSlug: string;
  order: number;
  title: string;
  situation: string;
  brief: string;
  hints: string[];
  durationDays: number;
  xp: number;
  objectives: { id: string; label: string; why?: string }[];
}

export interface MissionEntry {
  mission: MissionCard;
  status: GMissionStatus;
  score: number | null;
  accountId: string | null;
}

const STATUS_CHIP: Record<GMissionStatus, { label: string; className: string }> = {
  locked: { label: 'Locked', className: 'bg-[var(--line)] text-[var(--text-muted)]' },
  available: { label: 'Ready', className: 'bg-[var(--ink)] text-white' },
  in_progress: { label: 'In progress', className: 'bg-[var(--amber)] text-[var(--ink)]' },
  passed: { label: 'Passed', className: 'bg-[var(--green)] text-white' },
  failed: { label: 'Try again', className: 'bg-[var(--red)] text-white' },
};

export function GoogleMissionHub({
  entries, sandboxAccountId,
}: {
  entries: MissionEntry[];
  sandboxAccountId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(
    entries.find((e) => e.status === 'available' || e.status === 'in_progress')?.mission.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const start = async (missionId: string) => {
    setBusy(missionId);
    setError(null);
    try {
      const res = await fetch('/api/gsim/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', missionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not start the mission.');
      router.push(`/courses/google-ads/run/play/${json.accountId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the mission.');
      setBusy(null);
    }
  };

  return (
    <div>
      {error ? (
        <p className="mb-4 rounded-lg border-2 border-[var(--red)] bg-[var(--red)]/10 px-3 py-2 text-sm font-semibold">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {entries.map(({ mission, status, score, accountId }) => {
          const chip = STATUS_CHIP[status];
          const isOpen = open === mission.id;
          const locked = status === 'locked';

          return (
            <Card key={mission.id} className="overflow-hidden p-0">
              <button
                type="button"
                className="flex w-full items-start gap-3 p-4 text-left disabled:cursor-not-allowed"
                onClick={() => setOpen(isOpen ? null : mission.id)}
                disabled={locked}
                aria-expanded={isOpen}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-[var(--ink)] bg-[var(--card)] text-sm font-extrabold">
                  {locked ? <Lock size={14} />
                    : status === 'passed' ? <CheckCircle2 size={16} className="text-[var(--green)]" />
                      : status === 'failed' ? <XCircle size={16} className="text-[var(--red)]" />
                        : mission.order}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold tracking-tight">{mission.title}</span>
                    <span className={`chip ${chip.className}`}>{chip.label}</span>
                    {score !== null ? (
                      <span className="text-xs font-bold text-[var(--text-muted)]">{score}%</span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--text-muted)]">
                    {locked ? 'Finish the mission before this one to open it.' : mission.situation}
                  </span>
                </span>

                {!locked ? (
                  <ChevronDown
                    size={16}
                    className={`mt-1 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`}
                  />
                ) : null}
              </button>

              {isOpen && !locked ? (
                <div className="border-t-2 border-dashed border-[var(--line)] p-4 pt-4">
                  <p className="text-sm leading-relaxed">{mission.brief}</p>

                  <h4 className="mt-4 text-xs font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
                    Graded on
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {mission.objectives.map((o) => (
                      <li key={o.id} className="text-sm">
                        <span className="font-semibold">{o.label}</span>
                        {o.why ? (
                          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-muted)]">
                            {o.why}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  <details className="mt-4">
                    <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
                      Hints ({mission.hints.length})
                    </summary>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--text-muted)]">
                      {mission.hints.map((h) => <li key={h}>{h}</li>)}
                    </ul>
                  </details>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {accountId && status === 'in_progress' ? (
                      <Link
                        href={`/courses/google-ads/run/play/${accountId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[var(--ink)] bg-[var(--ink)] px-3.5 py-2 text-sm font-bold text-white shadow-[3px_3px_0_var(--ink)]"
                      >
                        <PlayCircle size={15} /> Continue
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => start(mission.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[var(--ink)] bg-[var(--ink)] px-3.5 py-2 text-sm font-bold text-white shadow-[3px_3px_0_var(--ink)] disabled:opacity-60"
                      >
                        {busy === mission.id ? <Loader2 size={15} className="animate-spin" />
                          : status === 'passed' || status === 'failed' ? <RotateCcw size={15} />
                            : <PlayCircle size={15} />}
                        {status === 'passed' || status === 'failed' ? 'Play again' : 'Start mission'}
                      </button>
                    )}
                    <span className="text-xs font-semibold text-[var(--text-muted)]">
                      {mission.durationDays} days · {mission.xp} XP
                    </span>
                  </div>

                  {status === 'passed' || status === 'failed' ? (
                    <p className="mt-3 text-xs text-[var(--text-muted)]">
                      Playing again starts a fresh account. Your previous attempt is replaced.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 p-5">
        <h3 className="text-lg font-extrabold tracking-tight">Free play</h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          An account with a Search campaign, a Performance Max campaign and an App campaign
          all running at once, competing for the same money and — in two cases — the same
          searches. No objectives, no clock, nothing graded.
        </p>
        <Link
          href={sandboxAccountId
            ? `/courses/google-ads/run/play/${sandboxAccountId}`
            : '/courses/google-ads/run/play/sandbox'}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border-2 border-[var(--ink)] bg-[var(--card)] px-3.5 py-2 text-sm font-bold shadow-[3px_3px_0_var(--ink)]"
        >
          <PlayCircle size={15} /> {sandboxAccountId ? 'Open your account' : 'Open a free-play account'}
        </Link>
      </Card>
    </div>
  );
}
