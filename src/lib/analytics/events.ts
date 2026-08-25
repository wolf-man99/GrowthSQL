import posthog from '@/lib/posthog/client';

/**
 * Client-side product events: the checkout funnel, and what learners actually do.
 *
 * Each event goes to two places: PostHog for product analytics, and the GTM
 * dataLayer so Meta Pixel / Google Ads conversions can be configured in Tag
 * Manager without shipping more code. Both are best-effort. Analytics must
 * never be able to break a purchase or a lesson, so every call is swallowed on
 * failure and a missing PostHog key is a silent no-op rather than an error.
 *
 * The dialog also puts `?pricing=<courseId>` in the URL while it is open, so
 * URL-triggered conversion setups work alongside these events.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type CheckoutEvent =
  | 'pricing_viewed'
  | 'checkout_started'
  | 'checkout_dismissed'
  | 'purchase_completed'
  | 'purchase_failed';

/**
 * What a learner did, as opposed to what they bought.
 *
 * Kept to things that mean something on their own. "Ran a query" and "answered a
 * quiz question" tell you whether the product is being used; a click on a
 * disclosure triangle does not, and a funnel cluttered with it is harder to read
 * than one without it.
 */
export type LearningEvent =
  | 'account_authenticated'
  | 'sql_query_executed'
  | 'exercise_hint_revealed'
  | 'quiz_answered'
  | 'flashcard_reviewed'
  | 'lesson_day_completed'
  | 'invite_link_copied';

export type AnalyticsEvent = CheckoutEvent | LearningEvent;

export function track(event: AnalyticsEvent, properties: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;

  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    try {
      posthog.capture(event, properties);
    } catch {
      // ignored: analytics is never allowed to interrupt checkout
    }
  }

  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event, ...properties });
  } catch {
    // ignored: same reason
  }
}

/**
 * Ties everything since the last anonymous event to a real learner.
 *
 * Without this every event in the product is anonymous, which sounds like a
 * privacy nicety and is actually a measurement hole: a signup and the purchase
 * that follows it a week later look like two unrelated strangers, so the funnel
 * the checkout events exist to measure cannot be assembled at all.
 *
 * Only the profile id is sent. Name and email stay out of PostHog deliberately —
 * nothing in the analytics answers a question that needs them.
 */
export function identify(profileId: string): void {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.identify(profileId);
  } catch {
    // ignored: same reason
  }
}

/** Ends the identified session on sign-out, so a shared machine does not attribute
 *  the next person's browsing to whoever used it last. */
export function resetIdentity(): void {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.reset();
  } catch {
    // ignored: same reason
  }
}
