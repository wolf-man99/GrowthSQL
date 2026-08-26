'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, ChevronDown, User, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { identify, resetIdentity } from '@/lib/analytics/events';

interface Me { id: string; displayName: string; email: string | null; image: string | null; avatarSeed: string; isAdmin?: boolean }

export function UserMenu() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      setMe(d.user);
      // The one place in the app chrome that already knows who is signed in, so
      // identifying here costs no extra request.
      if (d.user?.id) identify(d.user.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    resetIdentity();
    router.push('/');
    router.refresh();
  };

  const initial = (me?.displayName ?? 'A').charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-1 pl-1 pr-2 transition-colors hover:border-[var(--border-strong)]">
        {me?.image
          // eslint-disable-next-line @next/next/no-img-element -- external avatar, no domain config needed
          ? <img src={me.image} alt="" className="h-7 w-7 rounded-full" />
          : <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent-text)]">{initial}</span>}
        <ChevronDown size={13} className={cn('text-[var(--text-faint)] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--elevated)] shadow-xl">
          <div className="border-b border-[var(--border)] p-3">
            <div className="truncate text-sm font-medium">{me?.displayName ?? 'Analyst'}</div>
            <div className="truncate text-xs text-[var(--text-subtle)]">{me?.email ?? 'Signed in'}</div>
          </div>
          <div className="p-1">
            <MenuItem icon={<User size={15} />} label="Dashboard" onClick={() => { router.push('/dashboard'); setOpen(false); }} />
            <MenuItem icon={<Settings size={15} />} label="Courses" onClick={() => { router.push('/courses'); setOpen(false); }} />
            {/* The only entrance to the admin dashboard. Without it an admin has to
                know the URL, which is how a working page looks broken. */}
            {me?.isAdmin && (
              <MenuItem icon={<BarChart3 size={15} />} label="Platform analytics" onClick={() => { router.push('/admin'); setOpen(false); }} />
            )}
            <MenuItem icon={<LogOut size={15} />} label="Sign out" onClick={logout} danger />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]', danger ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]')}>
      {icon} {label}
    </button>
  );
}
