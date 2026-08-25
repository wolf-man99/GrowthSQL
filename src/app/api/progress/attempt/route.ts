import { recordAttempt } from '@/lib/progress/persist';
import { hasLearnTier, isLessonUnlocked } from '@/lib/progress/gating';
import { getProfileId } from '@/lib/auth/server';

export const runtime = 'nodejs';

/**
 * Record a non-SQL graded event: a quiz answer, an assessment result, a completed
 * flashcard drill. SQL exercises go through /api/sql/grade instead.
 */
export async function POST(req: Request) {
  const profileId = await getProfileId();
  if (!profileId) return Response.json({ error: 'Not signed in.' }, { status: 401 });

  let body: {
    itemType?: string;
    itemId?: string;
    courseId?: string;
    passed?: boolean;
    difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
    concepts?: string[];
    ms?: number;
    xpOverride?: number;
    today?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body.itemType || !body.itemId) {
    return Response.json({ error: 'itemType and itemId are required.' }, { status: 400 });
  }

  // The real gate. This is the only code path that grants XP for a lesson pass, so
  // checking here (not just hiding the UI) is what actually stops a paywall bypass.
  // Every course with a gated Learn tier goes through this, not just Meta Ads.
  // A per-course `if` here is how a new course silently ships without a paywall.
  if (body.courseId && body.itemType === 'lesson' && hasLearnTier(body.courseId)) {
    const unlocked = await isLessonUnlocked(profileId, body.courseId, body.itemId);
    if (!unlocked) return Response.json({ error: 'Upgrade required to unlock this module.' }, { status: 402 });
  }

  const progress = await recordAttempt({
    profileId,
    courseId: body.courseId,
    itemType: body.itemType,
    itemId: body.itemId,
    sql: '',
    passed: Boolean(body.passed),
    ms: body.ms ?? 0,
    difficulty: body.difficulty,
    concepts: body.concepts,
    xpOverride: typeof body.xpOverride === 'number' ? Math.max(0, Math.min(500, body.xpOverride)) : undefined,
    today: body.today,
  });
  return Response.json({ ok: true, progress });
}
