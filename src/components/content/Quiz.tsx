'use client';

import { useState } from 'react';
import { Check, X, CircleCheck } from 'lucide-react';
import type { QuizQuestion } from '@/lib/content/types';
import { CodeBlock } from './BlockRenderer';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics/events';

/** Interactive quiz: MCQ / predict / debug / explain / order. Self-graded, no scoring pressure. */
export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  return (
    <div className="space-y-4">
      {questions.map((q) => <Question key={q.id} q={q} />)}
    </div>
  );
}

function Question({ q }: { q: QuizQuestion }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [order, setOrder] = useState<string[]>(q.kind === 'order' ? shuffle(q.items) : []);
  const revealed = picked !== null || (q.kind === 'order' && order.join('|') !== '');

  if (q.kind === 'order') {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-medium">{q.prompt}</p>
        <div className="mt-3 space-y-1.5">
          {order.map((item, i) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
              <span className="grid h-5 w-5 place-items-center rounded bg-[var(--surface-3)] text-xs font-bold">{i + 1}</span>
              <span className="flex-1">{item}</span>
              <div className="flex gap-1">
                <button onClick={() => setOrder((o) => move(o, i, -1))} disabled={i === 0} className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30">▲</button>
                <button onClick={() => setOrder((o) => move(o, i, 1))} disabled={i === order.length - 1} className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30">▼</button>
              </div>
            </div>
          ))}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-[var(--accent-text)]">Check the correct order & why</summary>
          <ol className="ml-5 mt-2 list-decimal text-sm text-[var(--text-muted)]">{q.items.map((it) => <li key={it}>{it}</li>)}</ol>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{q.explanation}</p>
        </details>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start gap-2">
        <span className="chip shrink-0 capitalize">{q.kind}</span>
        <p className="text-sm font-medium">{q.prompt}</p>
      </div>
      {q.code && <div className="mt-2"><CodeBlock code={q.code} /></div>}
      <div className="mt-3 space-y-1.5">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.answer;
          const isPicked = i === picked;
          return (
            <button
              key={i}
              onClick={() => {
                if (picked !== null) return;
                track('quiz_answered', { questionId: q.id, kind: q.kind, correct: i === q.answer });
                setPicked(i);
              }}
              disabled={picked !== null}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                picked === null && 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
                revealed && isCorrect && 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]',
                revealed && isPicked && !isCorrect && 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]',
                revealed && !isCorrect && !isPicked && 'opacity-50',
              )}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-[10px]">
                {revealed && isCorrect ? <Check size={12} /> : revealed && isPicked ? <X size={12} /> : String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--text-muted)]">
          <CircleCheck size={15} className="mt-0.5 shrink-0 text-[var(--accent-text)]" />
          {q.explanation}
        </div>
      )}
    </div>
  );
}

function shuffle<T>(a: T[]): T[] { return [...a].sort(() => Math.random() - 0.5); }
function move<T>(a: T[], i: number, dir: number): T[] {
  const j = i + dir;
  if (j < 0 || j >= a.length) return a;
  const copy = [...a];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}
