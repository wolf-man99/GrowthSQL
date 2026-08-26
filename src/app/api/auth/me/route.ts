import { getCurrentProfile } from '@/lib/auth/server';
import { getAdmin } from '@/lib/auth/admin';
import { googleConfigured } from '@/lib/auth/google';

export const runtime = 'nodejs';

/** The signed-in user (or null), for client components that need auth state. */
export async function GET() {
  const p = await getCurrentProfile();
  // Resolved server-side against ADMIN_EMAILS rather than sent as a claim the
  // client could set. It only decides whether to *offer* the link; /admin
  // re-checks on every request, so a forged value buys nothing.
  const admin = p ? await getAdmin() : null;
  return Response.json({
    authenticated: Boolean(p),
    googleEnabled: googleConfigured(),
    user: p
      ? {
          id: p.id, displayName: p.displayName, email: p.email, image: p.image,
          avatarSeed: p.avatarSeed, level: p.level, referralCode: p.referralCode,
          isAdmin: Boolean(admin),
        }
      : null,
  });
}
