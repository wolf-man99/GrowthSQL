'use client';

import { LessonPlayer, type AnyLesson } from '@/components/courses/LessonPlayer';
import { MetaDiagram } from './MetaDiagram';
import { MetaCalculator } from './MetaCalculator';
import type { DiagramVariant, CalcVariant } from '@/lib/content/meta-ads/types';

/**
 * Meta Ads' binding of the shared lesson player.
 *
 * This wrapper exists for one reason, and it is not organisational. The shared
 * player takes `renderDiagram` and `renderCalculator` functions, and a function
 * cannot be passed from a Server Component to a Client Component — React has no
 * way to serialise it, and Next fails the request rather than the build. Creating
 * them here, inside a `'use client'` module, means they never cross the boundary:
 * the route passes only strings, and the closure is formed on the client side.
 *
 * It pays a second dividend. Because each course binds its own renderers in its
 * own client module, Meta's diagrams stay out of the Google Ads route's bundle
 * and vice versa, which a single shared registry keyed by course name would not
 * have managed.
 */
export function MetaLessonPlayer({ lesson, nextSlug }: { lesson: AnyLesson; nextSlug?: string }) {
  return (
    <LessonPlayer
      lesson={lesson}
      nextSlug={nextSlug}
      courseId="meta-ads"
      courseHref="/courses/meta-ads"
      renderDiagram={(v) => <MetaDiagram variant={v as DiagramVariant} />}
      renderCalculator={(v) => <MetaCalculator variant={v as CalcVariant} />}
    />
  );
}
