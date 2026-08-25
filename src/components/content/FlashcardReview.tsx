'use client';

import { useEffect, useState } from 'react';
import { Layers, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Button, Card } from '@/components/ui/primitives';
import { track } from '@/lib/analytics/events';

interface Card { id: string; deck: string; front: string; back: string; concept: string }

/** SM-2 flashcard review: flip, grade, advance. */
export function FlashcardReview() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => { load(); }, []);
  const load = () => fetch('/api/flashcards').then((r) => r.json()).then((d) => { setCards(d.due); setI(0); setFlipped(false); }).catch(() => setCards([]));

  const gradeCard = async (grade: number) => {
    if (!cards) return;
    const card = cards[i];
    await fetch('/api/flashcards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardId: card.id, grade }) });
    track('flashcard_reviewed', { deck: card.deck, concept: card.concept, grade });
    setReviewed((r) => r + 1);
    if (i + 1 < cards.length) { setI(i + 1); setFlipped(false); }
    else { setCards([]); }
  };

  if (!cards) return <div className="grid h-64 place-items-center text-sm text-[var(--text-subtle)]">Loading…</div>;

  if (cards.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <CheckCircle2 size={40} className="text-[var(--success)]" />
        <div className="text-lg font-semibold">All caught up</div>
        <p className="max-w-sm text-sm text-[var(--text-muted)]">
          {reviewed > 0 ? `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'} this session. ` : ''}
          Spaced repetition will surface the next batch when they&apos;re due.
        </p>
        <Button variant="secondary" onClick={load}><RotateCcw size={15} /> Refresh</Button>
      </Card>
    );
  }

  const card = cards[i];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5"><Layers size={15} /> {card.deck}</span>
        <span className="tabular-nums">{i + 1} / {cards.length}</span>
      </div>

      <button onClick={() => setFlipped((f) => !f)} className="block w-full">
        <Card className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center card-hover">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">{flipped ? 'Answer' : 'Question'}</div>
          <div className="text-lg leading-relaxed">{flipped ? card.back : card.front}</div>
          {!flipped && <div className="text-xs text-[var(--text-subtle)]">click to flip</div>}
        </Card>
      </button>

      {flipped && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { g: 0, label: 'Again', color: 'var(--danger)' },
            { g: 3, label: 'Hard', color: 'var(--warn)' },
            { g: 4, label: 'Good', color: 'var(--info)' },
            { g: 5, label: 'Easy', color: 'var(--success)' },
          ].map((b) => (
            <button key={b.g} onClick={() => gradeCard(b.g)} className="rounded-lg border border-[var(--border)] py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-2)]" style={{ color: b.color }}>
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
