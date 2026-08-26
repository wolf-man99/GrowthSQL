'use client';

/**
 * Choosing which business to run an account for.
 *
 * A real decision rather than a theme picker, which is why it gets a screen of its
 * own and why the copy leads with the arithmetic. NORTHBOUND sells a ₹4,200 pair of
 * shoes to somebody who decides in an afternoon; Ledgerline sells a ₹90,000 annual
 * contract to a committee and counts a booked demo as the conversion. The engine is
 * identical. What changes is what a click is worth, and therefore what a sane bid
 * is, which searches are worth having, and which of them are traps — and those
 * differences are most of what transfers when somebody changes jobs.
 *
 * The choice is made once and does not change, because a keyword list built for
 * running shoes has no business bidding on accounting software.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { VERTICAL_LIST, type VerticalId } from '@/lib/gsim/verticals';

export function GoogleRunStart({ resumable }: { resumable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<VerticalId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (vertical: VerticalId) => {
    setBusy(vertical);
    setError(null);
    try {
      const res = await fetch('/api/gsim/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical, restart: resumable }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not open the account.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the account.');
      setBusy(null);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-extrabold tracking-tight">Pick a business</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
        Same auction, same reports, completely different arithmetic. Choose once — the
        account you build is for the business you pick.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border-2 border-[var(--red)] bg-[var(--red)]/10 px-3 py-2 text-sm font-semibold">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {VERTICAL_LIST.map((v) => (
          <button
            key={v.id}
            type="button"
            disabled={busy !== null}
            onClick={() => start(v.id)}
            className="group rounded-2xl border-2 border-[var(--ink)] bg-[var(--card)] p-5 text-left shadow-[3px_3px_0_var(--ink)] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--ink)] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-extrabold tracking-tight">{v.brand}</span>
              {busy === v.id
                ? <Loader2 size={16} className="animate-spin" />
                : <ArrowRight size={16} className="opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" />}
            </div>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
              {v.label}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{v.premise}</p>

            <dl className="mt-4 space-y-1.5 border-t-2 border-dashed border-[var(--line)] pt-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-muted)]">What you sell</dt>
                <dd className="text-right font-semibold">{v.product}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Searches per day</dt>
                <dd className="font-semibold">{v.dailySearches.toLocaleString('en-IN')}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Break-even</dt>
                <dd className="font-semibold">
                  {v.breakEven.kind === 'roas'
                    ? `${v.breakEven.value.toFixed(2)}× return`
                    : `₹${Math.round(v.breakEven.value).toLocaleString('en-IN')} per ${v.conditions.conversionName.toLowerCase()}`}
                </dd>
              </div>
            </dl>
          </button>
        ))}
      </div>

      {resumable ? (
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Starting a new account leaves your current one behind. Its history stays, but the
          clock starts again from day zero.
        </p>
      ) : null}
    </div>
  );
}
