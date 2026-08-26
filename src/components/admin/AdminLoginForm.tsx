'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Loader, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

/**
 * The team's way in.
 *
 * Deliberately not the learner form with different copy. This is a staff portal:
 * no signup, no Google, no onboarding questions, no "start learning" framing, and
 * on success it goes straight to the dashboard rather than to the course
 * catalogue. Someone opening this is here to look at numbers, and every step
 * between them and the numbers is a step that should not exist.
 *
 * It posts to the same /api/auth/login as everyone else. There is one identity
 * system; what makes this a staff portal is where it lands and what it refuses to
 * offer, not a second set of credentials to keep in sync.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then((r) => r.json());

      if (!res.ok) {
        setError(res.error ?? 'Those details did not work.');
        return;
      }
      // Straight to the dashboard. /admin re-checks admin rights server-side, so a
      // learner who found this page still gets nowhere; they just get there by a
      // different route.
      router.push('/admin');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl border-2 border-[var(--ink)] bg-[var(--ink)] shadow-[3px_3px_0_var(--blue)]">
          <ShieldCheck size={19} className="text-white" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Team sign in</h1>
          <p className="text-sm text-[var(--text-muted)]">Platform analytics for Tiramisu staff.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border-2 border-[var(--ink)] bg-[var(--danger-soft)] p-3 text-sm font-semibold text-[var(--danger)]" role="alert">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Email</span>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            placeholder="you@tiramisu.com" autoComplete="username"
            className="h-11 w-full rounded-lg border-2 border-[var(--ink)] bg-white px-3 text-sm font-medium outline-none transition-all placeholder:font-normal placeholder:text-[var(--text-faint)] focus:shadow-[3px_3px_0_var(--blue)]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Password</span>
          <span className="relative block">
            <input
              type={revealed ? 'text' : 'password'} value={password}
              onChange={(e) => setPassword(e.target.value)} required
              placeholder="Your password" autoComplete="current-password"
              className="h-11 w-full rounded-lg border-2 border-[var(--ink)] bg-white px-3 pr-11 text-sm font-medium outline-none transition-all placeholder:font-normal placeholder:text-[var(--text-faint)] focus:shadow-[3px_3px_0_var(--blue)]"
            />
            <button
              type="button" onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? 'Hide password' : 'Show password'} aria-pressed={revealed}
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full justify-center" disabled={loading}>
          {loading ? <Loader size={16} className="animate-spin" /> : null}
          Sign in to analytics
        </Button>
      </div>
    </form>
  );
}
