import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { metaLessonBySlug, metaLessonItemId, nextMetaLesson } from '@/lib/content/meta-ads';
import { requireProfileId } from '@/lib/auth/server';
import { isMetaLessonUnlocked } from '@/lib/progress/gating';
import { Button } from '@/components/ui/primitives';
import { MetaLessonPlayer } from '@/components/meta/MetaLessonPlayer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function MetaLessonPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson: slug } = await params;
  const lesson = metaLessonBySlug(slug);
  if (!lesson) notFound();
  const profileId = await requireProfileId(`/courses/meta-ads/${slug}`);

  const unlocked = await isMetaLessonUnlocked(profileId, metaLessonItemId(lesson));
  if (!unlocked) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center md:px-8">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface-3)] shadow-[3px_3px_0_var(--ink)]">
          <Lock size={26} className="text-[var(--text-muted)]" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">This lesson is locked</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          &quot;{lesson.title}&quot; is past the free preview, unlock the rest of Learn to keep going.
        </p>
        <Link href="/courses/meta-ads#pricing" className="mt-6 inline-block">
          <Button size="lg">See pricing</Button>
        </Link>
        <Link href="/courses/meta-ads" className="mt-3 flex items-center justify-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft size={14} /> Back to Meta Ads Mastery
        </Link>
      </div>
    );
  }

  const next = nextMetaLesson(slug);
  return <MetaLessonPlayer lesson={lesson} nextSlug={next?.slug} />;
}
