'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Lock, Play, RotateCcw, Trophy } from 'lucide-react';
import { Card, Button } from '@/components/ui/primitives';
import { describeTarget, type Mission, type MissionStatus } from '@/lib/simulator/missions';
import { cn } from '@/lib/utils';

/**
 * The Run landing screen: pick a mission, or go and play freely.
 *
 * Missions come first because a blank account teaches nobody anything. Someone who
 * has just finished the theory needs a situation with a goal, not a sandbox and an
 * encouraging word. Free play unlocks alongside them for anyone who wants to
 * experiment, and it is where a learner ends up once the missions are done.
 */

export interface HubMission {
  mission: Pick<Mission, 'id' | 'title' | 'situation' | 'brief' | 'durationDays' | 'xp' | 'order' | 'objectives'>;
  status: MissionStatus;
  score: number | null;
  accountId: string | null;
}

const STATUS_LABEL: Record<MissionStatus, string> = {
  locked: 'Locked',
  available: 'Not started',
  in_progress: 'In progress',
  passed: 'Passed',
  failed: 'Try again',
};

export function MissionHub({
  missions, sandboxAccountId,
}: {
  missions: HubMission[];
  sandboxAccountId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (missionId: string, replay: boolean) => {
    if (replay && !window.confirm('Starting again abandons your current attempt at this mission. Continue?')) return;
    setError(null);
    setBusy(missionId);
    try {
      const res = await fetch('/api/sim/mission', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', missionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not start that mission.');
        return;
      }
      startTransition(() => router.push(`/courses/meta-ads/run/play/${data.accountId}`));
    } catch {
      setError('Network error. Nothing was started.');
    } finally {
      setBusy(null);
    }
  }, [router]);

  const passed = missions.filter((m) => m.status === 'passed').length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="chip bg-[var(--ink)] text-white">Missions</span>
        <span className="text-sm text-[var(--text-muted)]">
          {passed} of {missions.length} passed. Each one practises the module it came from.
        </span>
      </div>

      {error && (
        <Card className="mb-4 border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm font-semibold text-[var(--danger)]" role="alert">
          {error}
        </Card>
      )}

      <div className="grid gap-3">
        {missions.map(({ mission, status, score, accountId }) => {
          const locked = status === 'locked';
          const working = busy === mission.id || pending;
          return (
            <Card
              key={mission.id}
              className={cn('p-4', locked && 'opacity-60')}
              hover={!locked}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[11px] font-bold text-[var(--text-faint)]">
                      {String(mission.order).padStart(2, '0')}
                    </span>
                    <h3 className="text-[15px] font-extrabold">{mission.title}</h3>
                    <StatusChip status={status} score={score} />
                  </div>
                  <p className="mt-1.5 text-sm text-[var(--text-muted)]">{mission.situation}</p>

                  {!locked && (
                    <ul className="mt-2.5 grid gap-1">
                      {mission.objectives.map((o) => (
                        <li key={o.id} className="flex items-start gap-1.5 text-[12.5px] text-[var(--text-subtle)]">
                          <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--text-faint)]" />
                          <span>{o.label} <span className="text-[var(--text-faint)]">({describeTarget(o)})</span></span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-semibold text-[var(--text-faint)]">
                    <span>{mission.durationDays} simulated days</span>
                    <span>{mission.xp} XP</span>
                  </div>
                </div>

                <div className="shrink-0">
                  {locked ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-faint)]">
                      <Lock size={13} /> Finish the one above
                    </span>
                  ) : status === 'in_progress' && accountId ? (
                    <div className="flex flex-col gap-2">
                      <Button size="sm" onClick={() => router.push(`/courses/meta-ads/run/play/${accountId}`)}>
                        Continue <ArrowRight size={13} />
                      </Button>
                      <button
                        type="button"
                        className="text-[11px] font-bold text-[var(--text-faint)] hover:text-[var(--text)]"
                        onClick={() => start(mission.id, true)}
                        disabled={working}
                      >
                        Start over
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant={status === 'passed' ? 'secondary' : 'primary'}
                      disabled={working}
                      onClick={() => start(mission.id, status === 'passed' || status === 'failed')}
                    >
                      {status === 'passed' ? <><RotateCcw size={13} /> Replay</> : <><Play size={13} /> Start</>}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h3 className="text-[15px] font-extrabold">Free play</h3>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            NORTHBOUND&apos;s account, no objectives and no clock but yours. Break it, fix it, scale it.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => router.push(sandboxAccountId
            ? `/courses/meta-ads/run/play/${sandboxAccountId}`
            : '/courses/meta-ads/run/play/sandbox')}
        >
          Open the account <ArrowRight size={13} />
        </Button>
      </Card>
    </div>
  );
}

function StatusChip({ status, score }: { status: MissionStatus; score: number | null }) {
  if (status === 'passed') {
    return (
      <span className="chip bg-[var(--green)] text-white">
        <Trophy size={10} /> Passed{score !== null ? ` · ${score}%` : ''}
      </span>
    );
  }
  if (status === 'failed') {
    return <span className="chip bg-[var(--amber)] text-[var(--ink)]">{STATUS_LABEL.failed}{score !== null ? ` · ${score}%` : ''}</span>;
  }
  if (status === 'in_progress') {
    return <span className="chip bg-[var(--blue)] text-white">In progress</span>;
  }
  if (status === 'locked') {
    return <span className="chip bg-[var(--surface-3)] text-[var(--text-muted)]"><Lock size={10} /> Locked</span>;
  }
  return <span className="chip bg-[var(--surface-2)] text-[var(--text-muted)]"><Check size={10} /> Ready</span>;
}
