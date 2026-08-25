/**
 * Who may see the platform's own numbers.
 *
 * Admin rights live in `ADMIN_EMAILS`, a comma-separated deployment variable,
 * rather than in a column on Profile. Three reasons, in order of how much they
 * mattered:
 *
 *   - No migration. Every schema change here is a SQL statement someone has to
 *     paste into a database console by hand, and the way to keep that reliable is
 *     to need it less often, not to get better at it.
 *   - It cannot be escalated by a database write. A flag on a row can be flipped
 *     by anything holding the connection string; an environment variable takes a
 *     deploy, which is auditable and, more to the point, deliberate.
 *   - Revoking is a redeploy, not a data fix, and it takes effect for everyone at
 *     once rather than session by session.
 *
 * The cost is real and worth naming: adding an admin means a redeploy. At this
 * size that is the right trade. It stops being the right trade at roughly the
 * point where admins change more often than the code does.
 *
 * Admins sign in through the ordinary login, so this inherits the session,
 * cookie and password handling already in use rather than adding a second way in.
 */

import { notFound, redirect } from 'next/navigation';
import { prisma } from '../db';
import { getProfileId } from './server';

/** Parsed once per request rather than memoised: the value is read from the
 *  environment, and a module-level cache would survive a change to it in a
 *  long-lived server process. */
function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Whether the platform has any admins configured at all. */
export function isAdminConfigured(): boolean {
  return adminEmails().size > 0;
}

export interface AdminIdentity {
  profileId: string;
  email: string;
  displayName: string;
}

/**
 * The signed-in admin, or null.
 *
 * Deliberately re-reads the email from the database rather than trusting anything
 * in the session token. The token carries only a profile id, so an address that
 * was in `ADMIN_EMAILS` when the session was minted but is not now must stop
 * working immediately, and an id whose row was since deleted must fail closed.
 */
export async function getAdmin(): Promise<AdminIdentity | null> {
  const allowed = adminEmails();
  if (allowed.size === 0) return null;

  const profileId = await getProfileId();
  if (!profileId) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, email: true, displayName: true },
  });
  if (!profile?.email) return null;
  if (!allowed.has(profile.email.toLowerCase())) return null;

  return { profileId: profile.id, email: profile.email, displayName: profile.displayName };
}

/**
 * The signed-in admin, or away.
 *
 * A signed-out visitor goes to the login form and comes back. Anyone signed in
 * who is not an admin gets a 404 from the caller, not a "forbidden": the existence
 * of an admin area is not something a stranger needs confirmed.
 */
export async function requireAdmin(nextPath = '/admin'): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (admin) return admin;

  const profileId = await getProfileId();
  if (!profileId) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  // Signed in, not an admin.
  notFound();
}
