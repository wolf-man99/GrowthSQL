'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Play, CircleCheck, X, Lightbulb, Sparkles, RotateCcw, Clock, Coins, Zap,
  Database, PanelLeft, Loader, ChevronRight,
} from 'lucide-react';
import { Button, DifficultyPill, Chip } from '@/components/ui/primitives';
import { ResultsGrid } from './ResultsGrid';
import { SchemaPanel } from './SchemaPanel';
import { cn, formatMs } from '@/lib/utils';
import { track } from '@/lib/analytics/events';
import type { CompareResult } from '@/lib/grading/compare';
import type { Analysis } from '@/lib/coach/analyze';

const SqlEditor = dynamic(() => import('./SqlEditor').then((m) => m.SqlEditor), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[var(--text-subtle)]">Loading editor…</div>,
});

export interface WorkspaceExercise {
  id?: string;
  title: string;
  prompt: string;
  difficulty: string;
  tables: string[];
  concepts: string[];
  hints: string[];
}

interface GradeTarget {
  exerciseId?: string;
  task?: { collection: 'project' | 'interview' | 'capstone' | 'lab'; slug: string; taskId?: string };
}

interface RunResult { columns: string[]; rows: unknown[][]; rowCount: number; truncated: boolean; ms: number; notes: string[] }

export function QueryWorkspace({
  initialSql = '',
  exercise,
  grade,
}: {
  initialSql?: string;
  exercise?: WorkspaceExercise;
  grade?: GradeTarget;
}) {
  const [sql, setSql] = useState(initialSql || '-- Write BigQuery SQL here. Cmd/Ctrl+Enter to run.\n');
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [grading, setGrading] = useState(false);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [coach, setCoach] = useState<Analysis | null>(null);
  const [mentor, setMentor] = useState<string | null>(null);
  const [award, setAward] = useState<{ xp: number; coins: number; badges: string[] } | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [tab, setTab] = useState<'results' | 'coach'>('results');
  const [showSchema, setShowSchema] = useState(true);

  const run = useCallback(async () => {
    setRunning(true); setError(null); setPassed(null); setCoach(null); setMentor(null); setAward(null);
    try {
      const res = await fetch('/api/sql/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql }) }).then((r) => r.json());
      track('sql_query_executed', { surface: 'workspace', ok: Boolean(res.ok) });
      if (res.ok) { setResult(res); setTab('results'); }
      else setError({ message: res.error, hint: res.hint });
    } catch { setError({ message: 'Could not reach the query engine.' }); }
    setRunning(false);
  }, [sql]);

  const submit = useCallback(async () => {
    if (!grade) return;
    setGrading(true); setError(null);
    try {
      const body = grade.exerciseId
        ? { sql, exerciseId: grade.exerciseId, hintsUsed: revealed, itemType: 'exercise', itemId: grade.exerciseId }
        : { sql, ...grade.task, hintsUsed: revealed };
      const endpoint = grade.exerciseId ? '/api/sql/grade' : '/api/task/grade';
      const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
      setPassed(res.passed);
      setCompare(res.compare ?? null);
      setCoach(res.analysis ?? null);
      if (res.result) setResult(res.result);
      if (res.error) setError({ message: res.error.message, hint: res.error.hint });
      if (res.progress) setAward({ xp: res.progress.xpAwarded, coins: res.progress.coinsAwarded, badges: (res.progress.newBadges ?? []).map((b: { name: string }) => b.name) });
      setTab(res.passed ? 'results' : 'coach');
      // Ask the mentor for a paragraph (best-effort).
      fetch('/api/coach', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sql, passed: res.passed, compare: res.compare, error: res.error, exerciseId: grade.exerciseId, taskPrompt: exercise?.prompt, concepts: exercise?.concepts, hintsUsed: revealed, wantMentor: true }),
      }).then((r) => r.json()).then((d) => setMentor(d.mentor ?? null)).catch(() => {});
    } catch { setError({ message: 'Grading failed. Try again.' }); }
    setGrading(false);
  }, [sql, grade, revealed, exercise]);

  const insert = useCallback((text: string) => setSql((s) => `${s}${s.endsWith('\n') || s === '' ? '' : ' '}${text}`), []);

  return (
    <div className="flex h-full min-h-0">
      {/* Schema */}
      {showSchema && (
        <div className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg-subtle)] lg:block">
          <SchemaPanel onInsert={insert} />
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Prompt header */}
        {exercise && (
          <div className="border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-base font-semibold">{exercise.title}</h1>
                  <DifficultyPill difficulty={exercise.difficulty} />
                </div>
                <p className="mt-1.5 text-sm text-[var(--text-muted)]">{exercise.prompt}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {exercise.tables.map((t) => <Chip key={t}><Database size={11} /> {t}</Chip>)}
                  {exercise.concepts.map((c) => <Chip key={c} className="text-[var(--accent-text)]">{c.replace(/-/g, ' ')}</Chip>)}
                </div>
              </div>
            </div>
            {/* Hints */}
            {exercise.hints.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {exercise.hints.slice(0, revealed).map((h, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-[var(--warn-soft)] bg-[var(--warn-soft)] px-3 py-2 text-sm text-[var(--text-muted)]">
                    <Lightbulb size={14} className="mt-0.5 shrink-0 text-[var(--warn)]" /> {h}
                  </div>
                ))}
                {revealed < exercise.hints.length && (
                  <button
                    onClick={() => {
                      track('exercise_hint_revealed', { exerciseId: exercise.id, index: revealed + 1 });
                      setRevealed((r) => r + 1);
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-[var(--warn)] hover:underline"
                  >
                    <Lightbulb size={13} /> Reveal hint {revealed + 1} of {exercise.hints.length}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2">
          <Button variant="ghost" size="icon" onClick={() => setShowSchema((v) => !v)} className="hidden lg:inline-flex" title="Toggle schema">
            <PanelLeft size={16} />
          </Button>
          <Button size="sm" onClick={run} disabled={running} variant="secondary">
            {running ? <Loader size={14} className="animate-spin" /> : <Play size={14} />} Run
          </Button>
          {grade && (
            <Button size="sm" onClick={submit} disabled={grading}>
              {grading ? <Loader size={14} className="animate-spin" /> : <CircleCheck size={14} />} Submit
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setSql(initialSql); setResult(null); setPassed(null); setError(null); }} title="Reset">
            <RotateCcw size={14} />
          </Button>
          <div className="ml-auto flex items-center gap-3 text-xs text-[var(--text-subtle)]">
            {result && <span className="flex items-center gap-1"><Clock size={12} /> {formatMs(result.ms)}</span>}
            {result && <span>{result.rowCount} rows{result.truncated ? ' (capped)' : ''}</span>}
          </div>
        </div>

        {/* Editor + Results split */}
        <div className="grid min-h-0 flex-1 grid-rows-2">
          <div className="min-h-0 border-b border-[var(--border)]">
            <SqlEditor value={sql} onChange={setSql} onRun={run} />
          </div>

          <div className="flex min-h-0 flex-col">
            {/* Pass/fail banner */}
            {passed !== null && (
              <div className={cn('flex items-center gap-3 px-5 py-2.5 text-sm', passed ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]')}>
                {passed ? <CircleCheck size={16} /> : <X size={16} />}
                <span className="font-semibold">{passed ? 'Correct!' : 'Not quite. Check the coach tab.'}</span>
                {passed && award && award.xp > 0 && (
                  <span className="ml-auto flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-[var(--accent-text)]"><Zap size={12} /> +{award.xp} XP</span>
                    <span className="flex items-center gap-1 text-[var(--warn)]"><Coins size={12} /> +{award.coins}</span>
                    {award.badges.map((b) => <span key={b} className="chip">🏅 {b}</span>)}
                  </span>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--border)] px-4 py-1.5">
              <TabBtn active={tab === 'results'} onClick={() => setTab('results')}>Results</TabBtn>
              {(coach || grade) && <TabBtn active={tab === 'coach'} onClick={() => setTab('coach')}>AI Coach</TabBtn>}
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {tab === 'results' && (
                <>
                  {error && (
                    <div className="m-4 rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--danger)]"><X size={14} /> {error.message}</div>
                      {error.hint && <p className="mt-1.5 text-xs text-[var(--text-muted)]">{error.hint}</p>}
                    </div>
                  )}
                  {result?.notes && result.notes.length > 0 && (
                    <div className="border-b border-[var(--border)] bg-[var(--info-soft)] px-4 py-1.5 text-xs text-[var(--info)]">{result.notes[0]}</div>
                  )}
                  {result && result.columns.length > 0 ? <ResultsGrid columns={result.columns} rows={result.rows} /> : !error && (
                    <div className="grid h-full place-items-center text-sm text-[var(--text-subtle)]">Run a query to see results.</div>
                  )}
                </>
              )}
              {tab === 'coach' && <CoachPanel coach={coach} mentor={mentor} compare={compare} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('rounded-md px-3 py-1 text-[13px] font-medium transition-colors', active ? 'bg-[var(--surface-3)] text-[var(--text)]' : 'text-[var(--text-subtle)] hover:text-[var(--text-muted)]')}>
      {children}
    </button>
  );
}

function CoachPanel({ coach, mentor, compare }: { coach: Analysis | null; mentor: string | null; compare: CompareResult | null }) {
  if (!coach) return <div className="grid h-full place-items-center text-sm text-[var(--text-subtle)]">Submit an answer for coaching.</div>;
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent-soft)]"><Sparkles size={15} className="text-[var(--accent-text)]" /></span>
        <span className="text-sm font-semibold">{coach.headline}</span>
      </div>
      {mentor && (
        <div className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3 text-sm leading-relaxed text-[var(--text)]">
          {mentor}
        </div>
      )}
      {compare && !compare.passed && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--text-muted)]">
          Expected <span className="font-semibold text-[var(--text)]">{compare.expectedRowCount}</span> rows × {compare.expectedColumnCount} cols;
          {' '}got <span className="font-semibold text-[var(--text)]">{compare.actualRowCount}</span> × {compare.actualColumnCount}.
        </div>
      )}
      <div className="space-y-2">
        {coach.notes.map((n, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] p-3">
            <ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: noteColor(n.tone) }} />
            <div>
              <div className="text-[13px] font-medium" style={{ color: noteColor(n.tone) }}>{n.title}</div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{n.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function noteColor(tone: string): string {
  return { hint: 'var(--accent-text)', warn: 'var(--warn)', praise: 'var(--success)', style: 'var(--info)' }[tone] ?? 'var(--text-muted)';
}
