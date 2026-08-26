import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAdmin } from '@/lib/auth/admin';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team sign in - Tiramisu' };

/**
 * The staff portal's front door.
 *
 * Anyone already signed in as an admin is sent straight through rather than shown
 * a login form they do not need. Anyone else — signed out, or signed in as a
 * learner — gets the form, and the same form: telling a learner "you are not an
 * admin" here would confirm the existence of a staff area to whoever is asking.
 */
export default async function AdminLoginPage() {
  if (await getAdmin()) redirect('/admin');

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-5 py-12">
      <div className="w-full max-w-sm">
        <AdminLoginForm />
        <Link
          href="/"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} /> Back to Tiramisu
        </Link>
      </div>
    </div>
  );
}
