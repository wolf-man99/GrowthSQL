'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

/**
 * The editable half of the profile page.
 *
 * Read-only until you press Edit. A settings page whose fields are always live
 * invites accidental changes and gives no moment to confirm; a page that starts
 * as a record of what is true, and becomes a form on request, reads correctly for
 * both jobs — which is what was asked for, since the first purpose here is looking
 * your details up rather than changing them.
 *
 * Email is shown by the server component beside this and is not editable: it is
 * the login credential, and changing it without a verification step would be an
 * account takeover waiting to happen.
 */
export function ProfileForm({
  displayName: initialName,
  phone: initialPhone,
}: {
  displayName: string;
  phone: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const cancel = () => {
    setDisplayName(initialName);
    setPhone(initialPhone ?? '');
    setError(null);
    setEditing(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save.');
        return;
      }
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Refresh so the header, the greeting and anything else reading the name
      // update too, rather than leaving the page disagreeing with itself.
      router.refresh();
    } catch {
      setError('Network error. Nothing was saved.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="grid gap-4">
        <ReadRow label="Name" value={initialName} />
        <ReadRow label="Phone" value={initialPhone || 'Not set'} muted={!initialPhone} />
        <div className="flex items-center gap-3 pt-1">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit details
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--green)]">
              <Check size={15} /> Saved
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <EditRow label="Name" value={displayName} onChange={setDisplayName} placeholder="Alex Marketer" required />
      <EditRow label="Phone" value={phone} onChange={setPhone} placeholder="+91 98765 43210" type="tel" />

      {error && (
        <p className="text-sm font-semibold text-[var(--danger)]" role="alert">{error}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />} Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={saving}>
          <X size={14} /> Cancel
        </Button>
      </div>
    </form>
  );
}

function ReadRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-soft)] pb-3 last:border-0">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className={muted ? 'text-sm text-[var(--text-faint)]' : 'text-sm font-bold'}>{value}</span>
    </div>
  );
}

function EditRow({
  label, value, onChange, placeholder, type = 'text', required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-lg border-2 border-[var(--ink)] bg-white px-3 text-sm font-medium outline-none transition-all placeholder:font-normal placeholder:text-[var(--text-faint)] focus:shadow-[3px_3px_0_var(--blue)]"
      />
    </label>
  );
}
