'use client';

import { useEffect } from 'react';
import posthog, { isPostHogConfigured } from '@/lib/posthog/client';

/**
 * The last resort: an error thrown by the root layout itself.
 *
 * Every other failure is caught by a route's own boundary. This one replaces the
 * whole document, which is why it declares its own `<html>` and `<body>` — and
 * why the styles are inline. Next does not load global CSS here, so importing the
 * app's stylesheet would silently do nothing and leave a learner staring at
 * unstyled Times New Roman on the worst possible page to be looking at.
 *
 * The palette is copied from globals.css rather than referenced, deliberately. A
 * duplicated hex that goes stale costs a slightly-off shade on an error screen; a
 * var() that resolves to nothing costs black text on a transparent background.
 */

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Guarded: posthog is a no-op object until init runs, and if the root layout
    // is what threw then the provider that inits it may never have mounted.
    if (isPostHogConfigured()) posthog.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* metadata exports are unsupported in a client error boundary, so the
            document title comes from React's own <title> instead. */}
        <title>Something went wrong, Tiramisu</title>
        <style>{CSS}</style>
        <main className="wrap">
          <div className="card">
            <p className="eyebrow">Error</p>
            <h1>Something went wrong at our end</h1>
            <p className="body">
              This one is on us, not on anything you did. Your progress is saved, so trying
              again usually picks up exactly where you were.
            </p>
            <div className="actions">
              <button type="button" onClick={() => retry()} className="btn">Try again</button>
              {/* A plain anchor on purpose, against the lint rule's advice. next/link
                  soft-navigates inside the same React tree, and that tree is the one
                  that just failed. A full document load is the only thing here that
                  actually re-runs the root layout and escapes the broken state. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="btn btn-secondary">Go home</a>
            </div>
            {/* The digest is the only handle that ties this screen to a server log,
                so it is worth showing even though it means nothing to a learner. */}
            {error.digest && <p className="digest">Reference: {error.digest}</p>}
          </div>
        </main>
      </body>
    </html>
  );
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #fbf8f2;
    color: #0f2438;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
  }
  .card {
    max-width: 480px;
    background: #ffffff;
    border: 2px solid #0f2438;
    border-radius: 14px;
    box-shadow: 5px 5px 0 #0f2438;
    padding: 32px;
  }
  .eyebrow {
    margin: 0 0 10px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #e51f27;
  }
  h1 {
    margin: 0 0 12px;
    font-size: 26px;
    line-height: 1.2;
    letter-spacing: -0.02em;
    font-weight: 800;
  }
  .body { margin: 0 0 22px; font-size: 15px; line-height: 1.6; color: #4a5763; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .btn {
    display: inline-block;
    padding: 11px 20px;
    border: 2px solid #0f2438;
    border-radius: 10px;
    background: #045099;
    color: #ffffff;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 3px 3px 0 #0f2438;
  }
  .btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #0f2438; }
  .btn:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0 #0f2438; }
  .btn-secondary { background: #ffffff; color: #0f2438; }
  .digest {
    margin: 22px 0 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11.5px;
    color: #8d9aa6;
    word-break: break-all;
  }
  @media (prefers-reduced-motion: reduce) {
    .btn:hover, .btn:active { transform: none; }
  }
`;
