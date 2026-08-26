'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Loader, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { COURSES } from '@/lib/courses/registry';
import { LEARNING_GOALS, HEARD_FROM_OPTIONS } from '@/lib/auth/onboarding';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics/events';

const ERRORS: Record<string, string> = {
  google_unconfigured: 'Google sign-in isn’t configured on this deployment yet. Use email and password.',
  oauth_state: 'That Google sign-in link expired. Please try again.',
  oauth: 'Google sign-in failed. Please try again or use email.',
};

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/courses';

  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [courseInterest, setCourseInterest] = useState('');
  const [learningGoal, setLearningGoal] = useState('');
  const [heardFrom, setHeardFrom] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const e = params.get('error');
    if (e) setError(ERRORS[e] ?? 'Something went wrong.');
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setGoogleEnabled(d.googleEnabled)).catch(() => {});
  }, [params]);

  const goToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !phone.trim() || !email.trim() || password.length < 8) {
      setError('Fill in every field. Password needs at least 8 characters.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signup' && (!courseInterest || !learningGoal || !heardFrom)) {
      setError('Pick one option in each group to finish.');
      return;
    }
    setLoading(true); setError(null);
    try {
      const body = mode === 'signup'
        ? { email, password, displayName, phone, courseInterest, learningGoal, heardFrom }
        : { email, password };
      const res = await fetch(`/api/auth/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (res.ok) {
        track('account_authenticated', { method: mode });
        router.push(next); router.refresh();
      }
      else { setError(res.error ?? 'Please check your details.'); if (mode === 'signup') setStep(1); }
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  };

  const showingStep2 = mode === 'signup' && step === 2;

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--purple)] border-2 border-[var(--ink)] shadow-[3px_3px_0_var(--ink)]"><Sparkles size={19} className="text-white" /></span>
        <span className="font-display text-2xl font-extrabold tracking-tight">Tiramisu</span>
      </Link>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {mode === 'login' ? 'Welcome back' : showingStep2 ? 'Almost there' : 'Create your account'}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {mode === 'login'
                ? 'Sign in to pick up where you left off.'
                : showingStep2
                  ? 'A few quick picks so we can point you the right way.'
                  : 'Start learning in a couple of minutes. Your progress saves automatically.'}
            </p>
          </div>
          {mode === 'signup' && (
            <span className="mono shrink-0 rounded-full border-2 border-[var(--ink)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-bold tabular-nums">
              {step} / 2
            </span>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border-2 border-[var(--ink)] bg-[var(--danger-soft)] p-3 text-sm font-semibold text-[var(--danger)]">
            <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Field label="Email" value={email} onChange={setEmail} placeholder="you@company.com" type="email" required />
            <Field label="Password" value={password} onChange={setPassword} placeholder="At least 8 characters" type="password" required />
            <Button type="submit" size="lg" className="w-full justify-center" disabled={loading}>
              {loading ? <Loader size={16} className="animate-spin" /> : null}
              Sign in
            </Button>
          </form>
        )}

        {mode === 'signup' && step === 1 && (
          <form onSubmit={goToStep2} className="mt-5 space-y-3">
            <Field label="Name" value={displayName} onChange={setDisplayName} placeholder="Alex Marketer" type="text" required />
            <Field label="Phone number" value={phone} onChange={setPhone} placeholder="+91 98765 43210" type="tel" required />
            <Field label="Email" value={email} onChange={setEmail} placeholder="you@company.com" type="email" required />
            <Field label="Password" value={password} onChange={setPassword} placeholder="At least 8 characters" type="password" required />
            <Button type="submit" size="lg" className="w-full justify-center">Continue</Button>
          </form>
        )}

        {mode === 'signup' && step === 2 && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <ChipGroup label="What do you want to learn?" options={COURSES.map((c) => ({ id: c.id, label: c.title }))} value={courseInterest} onChange={setCourseInterest} />
            <ChipGroup label="What are you learning for?" options={LEARNING_GOALS} value={learningGoal} onChange={setLearningGoal} />
            <ChipGroup label="How did you hear about Tiramisu?" options={HEARD_FROM_OPTIONS} value={heardFrom} onChange={setHeardFrom} />

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" size="lg" aria-label="Back" onClick={() => { setError(null); setStep(1); }}>
                <ArrowLeft size={15} />
              </Button>
              <Button type="submit" size="lg" className="flex-1 justify-center" disabled={loading}>
                {loading ? <Loader size={16} className="animate-spin" /> : null}
                Create account
              </Button>
            </div>
          </form>
        )}

        {step === 1 && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-[var(--text-faint)]">
              <div className="h-px flex-1 bg-[var(--border)]" /> or <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <a href="/api/auth/google" className="block">
              <Button variant="secondary" size="lg" className="w-full justify-center gap-2" type="button">
                <GoogleIcon /> Continue with Google
              </Button>
            </a>
            {!googleEnabled && <p className="mt-2 text-center text-[11px] text-[var(--text-faint)]">Google sign-in activates once credentials are configured.</p>}
          </>
        )}

        <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
          {mode === 'signup' ? (
            <>Already have an account? <Link href="/login" className="font-medium text-[var(--accent-text)] hover:underline">Sign in</Link></>
          ) : (
            <>New here? <Link href="/signup" className="font-medium text-[var(--accent-text)] hover:underline">Create an account</Link></>
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * One labelled input.
 *
 * Password fields get a reveal toggle. It is not a convenience: password managers
 * are not universal, phone keyboards mistype, and the alternative to letting
 * someone check what they typed is letting them fail the login and guess why. The
 * toggle is a button rather than a checkbox so it can sit inside the field, and it
 * carries an aria-label because its only visible content is an icon.
 */
function Field({ label, value, onChange, placeholder, type, required }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type: string; required?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className="relative block">
        <input
          type={isPassword && revealed ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={cn(
            'h-11 w-full rounded-lg border-2 border-[var(--ink)] bg-white px-3 text-sm font-medium outline-none transition-all placeholder:font-normal placeholder:text-[var(--text-faint)] focus:shadow-[3px_3px_0_var(--blue)]',
            isPassword && 'pr-11',
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </span>
    </label>
  );
}

/** A single-select group of chip buttons, used for the step-2 onboarding picks. */
function ChipGroup({
  label, options, value, onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.id)}
              className={cn(
                'rounded-full border-2 border-[var(--ink)] px-3 py-1.5 text-[13px] font-bold transition-all focus-ring',
                selected ? 'bg-[var(--ink)] text-white' : 'bg-white text-[var(--ink)] hover:bg-[var(--surface-2)]',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
