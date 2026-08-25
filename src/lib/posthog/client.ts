import posthog from 'posthog-js';

export const initPostHog = () => {
  if (typeof window === 'undefined') return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    // PostHog not configured; app continues to work without it
    return;
  }

  posthog.init(apiKey, {
    api_host: 'https://us.i.posthog.com',
    loaded: (ph) => {
      // Errors nobody caught: an unhandled throw, a rejected promise nothing
      // awaited. Without this the only failures we ever hear about are the ones a
      // learner bothers to report, which are the loud ones rather than the common
      // ones. Console errors are left off deliberately: third-party scripts and
      // React's own development warnings would drown the signal.
      ph.startExceptionAutocapture({
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      });
      if (process.env.NODE_ENV === 'development') {
        ph.debug();
      }
    },
  });
};

/** Whether analytics is configured at all. Everything here no-ops without a key,
 *  so callers outside the provider tree check this before reaching for posthog. */
export const isPostHogConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

export default posthog;
