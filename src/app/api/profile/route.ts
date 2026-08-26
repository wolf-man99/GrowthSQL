import { prisma } from '@/lib/db';
import { getProfileId } from '@/lib/auth/server';

export const runtime = 'nodejs';

/**
 * Updating your own profile.
 *
 * Only two fields are writable, and the omissions are the design. Email is the
 * login credential, so changing it here would be an account takeover primitive
 * without a verification step this platform does not yet have. XP, level, streak
 * and entitlements are earned or paid for, so they are the server's to set.
 *
 * The profile id comes from the session, never from the body. A route that
 * accepted a target id would let anyone rename anyone.
 */
export async function PATCH(req: Request) {
  const profileId = await getProfileId();
  if (!profileId) return Response.json({ error: 'Not signed in.' }, { status: 401 });

  let body: { displayName?: unknown; phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const data: { displayName?: string; phone?: string } = {};

  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string') {
      return Response.json({ error: 'displayName must be text.' }, { status: 400 });
    }
    const name = body.displayName.trim();
    if (name.length < 2 || name.length > 60) {
      return Response.json({ error: 'Name needs to be between 2 and 60 characters.' }, { status: 400 });
    }
    data.displayName = name;
  }

  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string') {
      return Response.json({ error: 'phone must be text.' }, { status: 400 });
    }
    const phone = body.phone.trim();
    // Deliberately permissive: this is a contact field, not a verified one, and a
    // strict pattern would reject valid international formats to no benefit.
    if (phone.length > 0 && (phone.length < 6 || phone.length > 20)) {
      return Response.json({ error: 'That phone number does not look right.' }, { status: 400 });
    }
    data.phone = phone;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const profile = await prisma.profile.update({
    where: { id: profileId },
    data,
    select: { displayName: true, phone: true },
  });

  return Response.json({ ok: true, profile });
}
