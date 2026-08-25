'use client';

import { useEffect, useRef, useState } from 'react';
import { Share2, Check, Copy, Send, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics/events';

/**
 * Share-to-friends: copies a personal invite link (with the learner's referral code)
 * or opens a pre-filled post. Learning together and competing is more fun.
 */
export function ShareButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      const code = d.user?.referralCode;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setLink(`${origin}/signup${code ? `?ref=${code}` : ''}`);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      track('invite_link_copied');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  const text = encodeURIComponent("I'm learning SQL for marketing on Tiramisu. Come compete with me! 🚀");
  const url = encodeURIComponent(link);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]">
        <Share2 size={14} /> <span className="hidden sm:inline">Invite</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-3 shadow-xl">
          <div className="text-sm font-medium">Learn together, compete together</div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Share your invite link. Friends who join show up on your leaderboard.</p>
          <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-1.5">
            <span className="flex-1 truncate px-1 text-xs text-[var(--text-subtle)]">{link || '…'}</span>
            <button onClick={copy} className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors', copied ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--accent-soft)] text-[var(--accent-text)] hover:bg-[var(--accent)] hover:text-white')}>
              {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={`https://twitter.com/intent/tweet?text=${text}&url=${url}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"><Send size={13} /> Post to X</a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"><Users size={13} /> LinkedIn</a>
          </div>
        </div>
      )}
    </div>
  );
}
