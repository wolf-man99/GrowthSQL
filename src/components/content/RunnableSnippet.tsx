'use client';

import { useState } from 'react';
import { Play, Loader, ChevronDown, Clock } from 'lucide-react';
import { ResultsGrid } from '@/components/workspace/ResultsGrid';
import { cn, formatMs } from '@/lib/utils';
import { track } from '@/lib/analytics/events';

/** A read-only SQL block with an inline Run button and collapsible results. */
export function RunnableSnippet({ code, caption }: { code: string; caption?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{ columns: string[]; rows: unknown[][]; rowCount: number; ms: number; error?: string } | null>(null);

  const run = async () => {
    setLoading(true); setOpen(true);
    try {
      const r = await fetch('/api/sql/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: code }) }).then((x) => x.json());
      track('sql_query_executed', { surface: 'snippet', ok: Boolean(r.ok) });
      setRes(r.ok ? r : { columns: [], rows: [], rowCount: 0, ms: 0, error: r.error });
    } catch { setRes({ columns: [], rows: [], rowCount: 0, ms: 0, error: 'Engine unreachable.' }); }
    setLoading(false);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <span className="text-xs text-[var(--text-subtle)]">{caption ?? 'BigQuery SQL'}</span>
        <button onClick={run} disabled={loading} className="flex items-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-text)] transition-colors hover:bg-[var(--accent)] hover:text-white disabled:opacity-50">
          {loading ? <Loader size={12} className="animate-spin" /> : <Play size={12} />} Run
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed"><code className="mono text-[var(--text)]">{code}</code></pre>
      {res && (
        <div className="border-t border-[var(--border)]">
          <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-muted)]">
            <ChevronDown size={13} className={cn('transition-transform', !open && '-rotate-90')} />
            {res.error ? <span className="text-[var(--danger)]">{res.error}</span> : <><span>{res.rowCount} rows</span><span className="flex items-center gap-1 text-[var(--text-faint)]"><Clock size={11} /> {formatMs(res.ms)}</span></>}
          </button>
          {open && !res.error && res.columns.length > 0 && (
            <div className="max-h-64 overflow-auto border-t border-[var(--border)]"><ResultsGrid columns={res.columns} rows={res.rows} /></div>
          )}
        </div>
      )}
    </div>
  );
}
