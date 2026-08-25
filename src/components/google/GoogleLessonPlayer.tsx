'use client';

import { LessonPlayer, type AnyLesson } from '@/components/courses/LessonPlayer';
import { GoogleDiagram } from './GoogleDiagram';
import { GoogleCalculator } from './GoogleCalculator';
import type { GDiagramVariant, GCalcVariant } from '@/lib/content/google-ads/types';

/**
 * Google Ads' binding of the shared lesson player.
 *
 * See the note on MetaLessonPlayer for why each course needs its own thin client
 * wrapper: render functions cannot be passed from a Server Component, so they are
 * created here, inside the client boundary, rather than in the route.
 */
export function GoogleLessonPlayer({ lesson, nextSlug }: { lesson: AnyLesson; nextSlug?: string }) {
  return (
    <LessonPlayer
      lesson={lesson}
      nextSlug={nextSlug}
      courseId="google-ads"
      courseHref="/courses/google-ads"
      renderDiagram={(v) => <GoogleDiagram variant={v as GDiagramVariant} />}
      renderCalculator={(v) => <GoogleCalculator variant={v as GCalcVariant} />}
    />
  );
}
