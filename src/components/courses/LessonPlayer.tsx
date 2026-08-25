'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, ArrowLeft, Check, X, Lightbulb, Sparkles, PartyPopper, Zap, Loader, RotateCcw,
} from 'lucide-react';
import type { CourseLesson, LessonCard } from '@/lib/content/lesson-cards';
import { isInteractive } from '@/lib/content/lesson-cards';
import { BlockRenderer } from '@/components/content/BlockRenderer';
import { Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * The stepped lesson player, shared by every paid-media course.
 *
 * Started life inside the Meta course and was lifted out whole when Google Ads
 * needed the same thing. Only three things ever actually differed, and all three
 * are now parameters: which course the completion is recorded against, where
 * "back to course" goes, and how a diagram or calculator variant is drawn.
 *
 * The card type is loosened to `LessonCard<string, string>` at this boundary on
 * purpose. Each course's own content files stay strictly typed against their own
 * diagram and calculator unions, so an invalid variant is still a compile error
 * where it is authored — which is the place that matters. Making the player
 * generic over both unions instead would push that same type parameter through a
 * dozen internal components to buy nothing.
 */

export type AnyCard = LessonCard<string, string>;
export type AnyLesson = CourseLesson<string, string>;

export interface LessonPlayerProps {
  lesson: AnyLesson;
  nextSlug?: string;
  /** Recorded on the attempt, so progress and gating are scoped per course. */
  courseId: string;
  /** Where the close button and the finish screen return to. */
  courseHref: string;
  renderDiagram: (variant: string) => React.ReactNode;
  renderCalculator: (variant: string) => React.ReactNode;
}

export function LessonPlayer({
  lesson, nextSlug, courseId, courseHref, renderDiagram, renderCalculator,
}: LessonPlayerProps) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [awarded, setAwarded] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());

  const card = lesson.cards[i];
  const total = lesson.cards.length;
  const canContinue = !isInteractive(card) || answered[card.id];

  const onAnswer = (id: string, isCorrect: boolean) => {
    if (answered[id]) return;
    setAnswered((a) => ({ ...a, [id]: true }));
    if (isCorrect) setCorrect((c) => c + 1);
  };

  const next = async () => {
    if (i + 1 < total) { setI(i + 1); return; }
    // Finished, record completion.
    setSaving(true);
    try {
      const res = await fetch('/api/progress/attempt', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itemType: 'lesson', itemId: `${lesson.moduleSlug}/${lesson.slug}`, courseId,
          passed: true, xpOverride: lesson.xp, ms: Date.now() - startedAt,
        }),
      }).then((r) => r.json());
      setAwarded(res.progress?.xpAwarded ?? 0);
    } catch { setAwarded(0); }
    setSaving(false);
    setDone(true);
  };

  const interactiveCount = useMemo(() => lesson.cards.filter(isInteractive).length, [lesson.cards]);

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <div className="animate-fade-up">
          <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border-2 border-[var(--ink)] bg-[var(--amber)] shadow-[3px_3px_0_var(--ink)]"><PartyPopper size={30} className="text-[var(--ink)]" /></span>
          <h1 className="text-2xl font-semibold tracking-tight">Lesson complete!</h1>
          <p className="mt-2 text-[var(--text-muted)]">{lesson.title}</p>
          <div className="mx-auto mt-6 grid max-w-xs grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold tabular-nums text-[var(--accent-text)]"><Zap size={20} /> +{awarded ?? lesson.xp}</div>
              <div className="text-xs text-[var(--text-subtle)]">XP earned</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-2xl font-bold tabular-nums text-[var(--success)]">{correct}/{interactiveCount}</div>
              <div className="text-xs text-[var(--text-subtle)]">checks correct</div>
            </div>
          </div>
          {awarded === 0 && <p className="mt-3 text-xs text-[var(--text-faint)]">You’d already completed this one: no new XP, but great review.</p>}
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href={courseHref}><Button variant="secondary" size="lg">Back to course</Button></Link>
            {nextSlug
              ? <Button size="lg" onClick={() => router.push(`${courseHref}/${nextSlug}`)}>Next lesson <ArrowRight size={16} /></Button>
              : <Link href={courseHref}><Button size="lg">Finish <Check size={16} /></Button></Link>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-6">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-3">
        <Link href={courseHref} className="text-[var(--text-faint)] hover:text-[var(--text)]"><X size={18} /></Link>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${((i + (canContinue ? 1 : 0)) / total) * 100}%` }} />
        </div>
        <span className="text-xs tabular-nums text-[var(--text-subtle)]">{i + 1}/{total}</span>
      </div>

      {/* Card */}
      <div key={card.id} className="animate-fade-up flex-1">
        <CardView
          card={card}
          answered={Boolean(answered[card.id])}
          onAnswer={onAnswer}
          renderDiagram={renderDiagram}
          renderCalculator={renderCalculator}
        />
      </div>

      {/* Controls */}
      <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 border-t-2 border-[var(--ink)] bg-[var(--bg)] py-4">
        <Button variant="ghost" size="sm" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}><ArrowLeft size={15} /> Back</Button>
        <Button size="lg" onClick={next} disabled={!canContinue || saving}>
          {saving ? <Loader size={16} className="animate-spin" /> : null}
          {i + 1 < total ? 'Continue' : 'Finish lesson'} {i + 1 < total && <ArrowRight size={16} />}
        </Button>
      </div>
    </div>
  );
}

function CardView({
  card, answered, onAnswer, renderDiagram, renderCalculator,
}: {
  card: AnyCard;
  answered: boolean;
  onAnswer: (id: string, correct: boolean) => void;
  renderDiagram: (variant: string) => React.ReactNode;
  renderCalculator: (variant: string) => React.ReactNode;
}) {
  switch (card.kind) {
    case 'teach':
      return (
        <div className="space-y-4">
          {card.title && <h2 className="text-xl font-semibold tracking-tight">{card.title}</h2>}
          {card.art && renderDiagram(card.art)}
          <BlockRenderer blocks={card.blocks} />
        </div>
      );
    case 'diagram':
      return (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">{card.title}</h2>
          {renderDiagram(card.variant)}
          <p className="text-sm text-[var(--text-muted)]">{card.caption}</p>
        </div>
      );
    case 'tip':
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--warn-soft)] bg-[var(--warn-soft)] p-5">
          <Lightbulb size={22} className="mt-0.5 shrink-0 text-[var(--warn)]" />
          <div>
            <div className="font-semibold text-[var(--warn)]">{card.title}</div>
            <p className="mt-1 text-[var(--text-muted)]">{card.text}</p>
          </div>
        </div>
      );
    case 'calc':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Sparkles size={18} className="text-[var(--accent-text)]" /><h2 className="text-xl font-semibold tracking-tight">{card.title}</h2></div>
          <p className="text-sm text-[var(--text-muted)]">{card.blurb}</p>
          {renderCalculator(card.variant)}
        </div>
      );
    case 'mcq':
      return <Choice prompt={card.prompt} options={card.options} answerIndex={card.answer} explain={card.explain} answered={answered} onAnswer={(ok) => onAnswer(card.id, ok)} />;
    case 'truefalse':
      return <Choice prompt={card.statement} options={['True', 'False']} answerIndex={card.isTrue ? 0 : 1} explain={card.explain} answered={answered} onAnswer={(ok) => onAnswer(card.id, ok)} label="True or false?" />;
    case 'multi':
      return <Multi card={card} answered={answered} onAnswer={(ok) => onAnswer(card.id, ok)} />;
    case 'scenario':
      return <Scenario card={card} answered={answered} onAnswer={(ok) => onAnswer(card.id, ok)} />;
    case 'sort':
      return <Sort card={card} answered={answered} onAnswer={(ok) => onAnswer(card.id, ok)} />;
    default:
      return null;
  }
}

function Choice({ prompt, options, answerIndex, explain, answered, onAnswer, label }: { prompt: string; options: string[]; answerIndex: number; explain: string; answered: boolean; onAnswer: (ok: boolean) => void; label?: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const choose = (idx: number) => { if (answered) return; setPicked(idx); onAnswer(idx === answerIndex); };
  return (
    <div className="space-y-3">
      {label && <span className="chip">{label}</span>}
      <h2 className="text-lg font-semibold">{prompt}</h2>
      <div className="space-y-2">
        {options.map((opt, idx) => {
          const isAns = idx === answerIndex, isPick = idx === picked;
          return (
            <button key={idx} onClick={() => choose(idx)} disabled={answered}
              className={cn('flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors',
                !answered && 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
                answered && isAns && 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]',
                answered && isPick && !isAns && 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]',
                answered && !isAns && !isPick && 'opacity-50')}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-[11px]">{answered && isAns ? <Check size={13} /> : answered && isPick ? <X size={13} /> : String.fromCharCode(65 + idx)}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {answered && <Explain text={explain} good={picked === answerIndex} />}
    </div>
  );
}

function Multi({ card, answered, onAnswer }: { card: Extract<AnyCard, { kind: 'multi' }>; answered: boolean; onAnswer: (ok: boolean) => void }) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const submit = () => {
    if (answered) return;
    const ans = new Set(card.answers);
    const ok = sel.size === ans.size && [...sel].every((x) => ans.has(x));
    onAnswer(ok);
  };
  const toggle = (i: number) => { if (!answered) setSel((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; }); };
  return (
    <div className="space-y-3">
      <span className="chip">Select all that apply</span>
      <h2 className="text-lg font-semibold">{card.prompt}</h2>
      <div className="space-y-2">
        {card.options.map((opt, idx) => {
          const isAns = card.answers.includes(idx), isSel = sel.has(idx);
          return (
            <button key={idx} onClick={() => toggle(idx)} disabled={answered}
              className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors',
                answered ? (isAns ? 'border-[var(--success)] bg-[var(--success-soft)]' : isSel ? 'border-[var(--danger)] bg-[var(--danger-soft)]' : 'opacity-50')
                  : isSel ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]')}>
              <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded border', isSel ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border-strong)]')}>{isSel && <Check size={12} />}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {!answered ? <Button onClick={submit} disabled={sel.size === 0} variant="secondary">Check</Button> : <Explain text={card.explain} good />}
    </div>
  );
}

function Scenario({ card, answered, onAnswer }: { card: Extract<AnyCard, { kind: 'scenario' }>; answered: boolean; onAnswer: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const choose = (idx: number) => { if (answered) return; setPicked(idx); onAnswer(card.options[idx].correct); };
  return (
    <div className="space-y-3">
      <span className="chip">What would you do?</span>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text)]">{card.situation}</div>
      <div className="space-y-2">
        {card.options.map((opt, idx) => {
          const isPick = idx === picked;
          return (
            <div key={idx}>
              <button onClick={() => choose(idx)} disabled={answered}
                className={cn('flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors',
                  !answered && 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
                  answered && opt.correct && 'border-[var(--success)] bg-[var(--success-soft)]',
                  answered && isPick && !opt.correct && 'border-[var(--danger)] bg-[var(--danger-soft)]',
                  answered && !opt.correct && !isPick && 'opacity-50')}>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-[11px]">{answered && opt.correct ? <Check size={13} /> : answered && isPick ? <X size={13} /> : String.fromCharCode(65 + idx)}</span>
                {opt.label}
              </button>
              {answered && isPick && <p className="ml-2 mt-1.5 text-[13px] text-[var(--text-muted)]">{opt.feedback}</p>}
              {answered && !isPick && opt.correct && <p className="ml-2 mt-1.5 text-[13px] text-[var(--success)]">{opt.feedback}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Sort({ card, answered, onAnswer }: { card: Extract<AnyCard, { kind: 'sort' }>; answered: boolean; onAnswer: (ok: boolean) => void }) {
  const [order, setOrder] = useState<string[]>(() => [...card.items].sort(() => Math.random() - 0.5));
  const move = (i: number, d: number) => { if (answered) return; const j = i + d; if (j < 0 || j >= order.length) return; setOrder((o) => { const n = [...o]; [n[i], n[j]] = [n[j], n[i]]; return n; }); };
  const submit = () => { if (answered) return; onAnswer(order.join('|') === card.items.join('|')); };
  return (
    <div className="space-y-3">
      <span className="chip">Put these in order</span>
      <h2 className="text-lg font-semibold">{card.prompt}</h2>
      <div className="space-y-1.5">
        {order.map((item, idx) => {
          const rightSpot = answered && card.items[idx] === item;
          return (
            <div key={item} className={cn('flex items-center gap-2 rounded-xl border p-3 text-sm', answered ? (rightSpot ? 'border-[var(--success)] bg-[var(--success-soft)]' : 'border-[var(--danger)] bg-[var(--danger-soft)]') : 'border-[var(--border)] bg-[var(--surface)]')}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[var(--surface-3)] text-xs font-bold">{idx + 1}</span>
              <span className="flex-1">{item}</span>
              {!answered && <div className="flex flex-col text-[var(--text-faint)]">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="hover:text-[var(--text)] disabled:opacity-30">▲</button>
                <button onClick={() => move(idx, 1)} disabled={idx === order.length - 1} className="hover:text-[var(--text)] disabled:opacity-30">▼</button>
              </div>}
            </div>
          );
        })}
      </div>
      {!answered ? <Button onClick={submit} variant="secondary"><RotateCcw size={14} /> Check order</Button> : <Explain text={card.explain} good={order.join('|') === card.items.join('|')} />}
    </div>
  );
}

function Explain({ text, good }: { text: string; good: boolean }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-xl p-3 text-sm', good ? 'bg-[var(--success-soft)] text-[var(--text-muted)]' : 'bg-[var(--surface-2)] text-[var(--text-muted)]')}>
      {good ? <Check size={15} className="mt-0.5 shrink-0 text-[var(--success)]" /> : <Lightbulb size={15} className="mt-0.5 shrink-0 text-[var(--warn)]" />}
      <span>{text}</span>
    </div>
  );
}
