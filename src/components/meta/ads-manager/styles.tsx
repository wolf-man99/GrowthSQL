'use client';

/**
 * The Ads Manager skin.
 *
 * A deliberate, literal recreation of Meta Ads Manager's own chrome (grey ground,
 * hairline borders, Meta blue, dense small type) rather than Tiramisu's
 * neo-brutalist system used everywhere else. The break is intentional: the learner
 * should build muscle memory for the tool they will actually use on the job, inside
 * a page that never claims to be the genuine product.
 *
 * Extracted here so the frozen case-study viewer and the live simulator render the
 * same surface. Scoped under `.mb-shell`, so nothing leaks into the surrounding app.
 */
export function AdsManagerStyles() {
  return (
    <style>{`
        .mb-shell {
          --m-bg: #f0f2f5;
          --m-card: #ffffff;
          --m-line: #dadde1;
          --m-ink: #1c1e21;
          --m-muted: #65676b;
          --m-faint: #8a8d91;
          --m-blue: #1877f2;
          --m-blue-soft: #e7f0ff;
          --m-green: #31a24c;
          --m-amber: #f0a20d;
          position: relative;
          background: var(--m-bg);
          color: var(--m-ink);
          font-family: "Segoe UI", -apple-system, Roboto, Helvetica, Arial, sans-serif;
          display: grid;
          grid-template-columns: 220px 1fr;
          min-height: 640px;
          border: 1px solid var(--m-line);
          border-radius: 12px;
          overflow: hidden;
        }
        .mb-shell * { box-sizing: border-box; }

        .mb-backdrop { position: fixed; inset: 0; z-index: 40; background: transparent; }

        .mb-side { background: var(--m-card); border-right: 1px solid var(--m-line); padding: 18px 12px; }
        .mb-logo { display: flex; align-items: center; gap: 9px; padding: 4px 8px 18px; font-weight: 700; font-size: 15px; }
        .mb-logo-mark { width: 24px; height: 24px; border-radius: 6px; background: var(--m-blue); display: inline-block; }
        .mb-nav-item {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 9px 10px; border-radius: 6px; font: 500 13.5px/1 inherit;
          color: var(--m-muted); margin-bottom: 2px; cursor: pointer;
          background: none; border: none; text-align: left;
        }
        .mb-nav-item:hover { background: #f2f3f5; }
        .mb-nav-dot { width: 16px; height: 16px; border-radius: 4px; background: var(--m-line); flex-shrink: 0; }
        .mb-nav-on { background: var(--m-blue-soft); color: var(--m-blue); font-weight: 700; }
        .mb-nav-on:hover { background: var(--m-blue-soft); }
        .mb-nav-on .mb-nav-dot { background: var(--m-blue); }

        .mb-main { padding: 22px 26px 28px; min-width: 0; position: relative; }
        .mb-topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .mb-topbar h1 { font-size: 19px; font-weight: 700; margin: 0; }
        .mb-breadcrumb { font-size: 12.5px; color: var(--m-muted); margin: 2px 0 0; }
        .mb-topbar-right { display: flex; align-items: center; gap: 8px; }
        .mb-sim-badge {
          font-size: 11px; font-weight: 700; color: #7a5b00; background: #fff4d6;
          border: 1px solid #f0d98c; border-radius: 999px; padding: 5px 10px;
        }

        .mb-range-wrap, .mb-cols-wrap { position: relative; }
        .mb-range {
          display: inline-flex; align-items: center; gap: 6px;
          font: 500 12.5px/1 inherit; color: var(--m-muted);
          border: 1px solid var(--m-line); background: var(--m-card); padding: 7px 13px; border-radius: 6px; cursor: pointer;
        }
        .mb-range-panel, .mb-cols-panel {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
          background: var(--m-card); border: 1px solid var(--m-line); border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,.12); padding: 8px; min-width: 200px;
        }
        .mb-range-opt {
          display: block; width: 100%; text-align: left; font: 500 13px/1 inherit;
          padding: 8px 10px; border-radius: 6px; border: none; background: none; color: var(--m-ink); cursor: pointer;
        }
        .mb-range-opt:hover { background: #f2f3f5; }
        .mb-range-opt-on { background: var(--m-blue-soft); color: var(--m-blue); font-weight: 700; }
        .mb-range-custom { padding: 8px 6px 4px; border-top: 1px solid var(--m-line); margin-top: 4px; display: flex; flex-direction: column; gap: 8px; }
        .mb-range-custom label { display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; color: var(--m-muted); font-weight: 600; }
        .mb-range-custom input[type="date"] { font: 500 12.5px inherit; padding: 6px 8px; border: 1px solid var(--m-line); border-radius: 6px; }

        .mb-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
        .mb-kpi { background: var(--m-card); border: 1px solid var(--m-line); border-radius: 8px; padding: 13px 14px; }
        .mb-kpi-l { font-size: 11.5px; color: var(--m-muted); font-weight: 500; }
        .mb-kpi-v { font-size: 19px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }

        .mb-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
        .mb-filters { display: flex; flex-wrap: wrap; gap: 6px; }
        .mb-filter {
          font: 500 12.5px/1 inherit; padding: 7px 13px; border-radius: 6px;
          border: 1px solid var(--m-line); background: var(--m-card); color: var(--m-muted); cursor: pointer;
        }
        .mb-filter-on { background: var(--m-blue-soft); border-color: var(--m-blue); color: var(--m-blue); font-weight: 700; }

        .mb-actions { display: flex; align-items: center; gap: 8px; }
        .mb-toolbtn {
          display: inline-flex; align-items: center; gap: 6px;
          font: 600 12.5px/1 inherit; padding: 7px 13px; border-radius: 6px;
          border: 1px solid var(--m-line); background: var(--m-card); color: var(--m-muted); cursor: pointer;
        }
        .mb-toolbtn:hover { background: #f2f3f5; }
        .mb-btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          font: 700 12.5px/1 inherit; padding: 8px 14px; border-radius: 6px;
          border: 1px solid var(--m-blue); background: var(--m-blue); color: #fff; cursor: pointer;
        }
        .mb-btn-primary:hover { background: #166fe0; }
        .mb-btn-secondary {
          font: 600 12.5px/1 inherit; padding: 8px 14px; border-radius: 6px;
          border: 1px solid var(--m-line); background: var(--m-card); color: var(--m-ink); cursor: pointer;
        }

        .mb-cols-panel { min-width: 240px; max-height: 380px; overflow-y: auto; }
        .mb-cols-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 8px; font-size: 12.5px; font-weight: 700; border-bottom: 1px solid var(--m-line); margin-bottom: 4px; }
        .mb-cols-reset { font: 600 11px/1 inherit; color: var(--m-blue); background: none; border: none; cursor: pointer; }
        .mb-cols-group-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--m-faint); padding: 8px 8px 4px; }
        .mb-cols-item { display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
        .mb-cols-item:hover { background: #f2f3f5; }
        .mb-cols-done { width: 100%; justify-content: center; margin-top: 6px; }

        .mb-table-wrap { overflow-x: auto; background: var(--m-card); border: 1px solid var(--m-line); border-radius: 8px; }
        .mb-table { width: 100%; min-width: 980px; border-collapse: collapse; }
        .mb-table th {
          text-align: left; font-size: 11.5px; color: var(--m-muted); font-weight: 600;
          padding: 10px 13px; border-bottom: 1px solid var(--m-line); background: #fafbfc; white-space: nowrap;
        }
        .mb-table td { padding: 11px 13px; border-bottom: 1px solid var(--m-line); font-size: 12.5px; white-space: nowrap; }
        .mb-table tbody tr:hover { background: #fafbfc; }
        .mb-table tbody tr:last-child td { border-bottom: 1px solid var(--m-line); }
        .mb-table th.num, .mb-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .mb-col-toggle { width: 44px; }
        .mb-row-new td { background: #f4faf6; }

        .mb-campaign-name { color: var(--m-blue); font-weight: 500; }
        .mb-campaign-type { display: block; font-size: 11px; color: var(--m-faint); font-weight: 400; margin-top: 1px; }

        .mb-toggle { width: 30px; height: 17px; border-radius: 999px; background: var(--m-green); position: relative; display: inline-block; }
        .mb-toggle::after { content: ""; width: 13px; height: 13px; border-radius: 50%; background: #fff; position: absolute; right: 2px; top: 2px; }

        .mb-delivery { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; }
        .mb-delivery::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--m-green); }

        .mb-table tfoot td { padding: 11px 13px; font-weight: 700; background: #fafbfc; border-top: 1px solid var(--m-line); border-bottom: none; }
        .mb-table tfoot td.num { text-align: right; font-variant-numeric: tabular-nums; }

        .mb-footnote { margin-top: 14px; font-size: 12px; color: var(--m-faint); max-width: 74ch; }

        .mb-creative-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .mb-creative-card { background: var(--m-card); border: 1px solid var(--m-line); border-radius: 8px; overflow: hidden; }
        .mb-creative-thumb { height: 110px; display: flex; align-items: center; justify-content: center; }
        .mb-creative-body { padding: 11px 12px 13px; }
        .mb-creative-name { font-size: 12.5px; font-weight: 600; color: var(--m-ink); line-height: 1.35; }
        .mb-creative-meta { font-size: 11px; color: var(--m-faint); margin-top: 3px; }
        .mb-creative-stats { display: flex; gap: 14px; margin-top: 9px; padding-top: 9px; border-top: 1px solid var(--m-line); font-size: 11px; color: var(--m-muted); }
        .mb-creative-stats b { font-size: 12.5px; color: var(--m-ink); font-variant-numeric: tabular-nums; display: block; }

        .mb-modal-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .mb-modal { width: 100%; max-width: 420px; background: var(--m-card); border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,.3); max-height: 90vh; overflow-y: auto; }
        .mb-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--m-line); }
        .mb-modal-head h2 { font-size: 16px; font-weight: 700; margin: 0; }
        .mb-modal-close { border: none; background: none; color: var(--m-muted); cursor: pointer; padding: 4px; display: flex; }
        .mb-modal-body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 12px; }
        .mb-field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--m-muted); }
        .mb-field input, .mb-field select {
          font: 500 13.5px inherit; color: var(--m-ink); padding: 9px 10px;
          border: 1px solid var(--m-line); border-radius: 6px; background: var(--m-card);
        }
        .mb-modal-error { font-size: 12.5px; font-weight: 600; color: #d32f2f; margin: 0; }
        .mb-modal-hint { font-size: 11.5px; color: var(--m-faint); margin: 0; line-height: 1.5; }
        .mb-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

        @media (max-width: 760px) {
          .mb-shell { grid-template-columns: 1fr; }
          .mb-side { display: none; }
          .mb-kpis { grid-template-columns: repeat(2, 1fr); }
          .mb-range-panel, .mb-cols-panel { right: auto; left: 0; }
        }

        /* ── Simulator-only: state the frozen viewer never has to show ────── */

        /* The secondary action beside a primary one. Named .mb-btn rather than
           reusing .mb-btn-secondary so the two can diverge: this one sits in the
           day bar where it needs to match the primary's height exactly. */
        .mb-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font: 600 12.5px/1 inherit; padding: 8px 14px; border-radius: 6px;
          border: 1px solid var(--m-line); background: var(--m-card);
          color: var(--m-ink); cursor: pointer;
        }
        .mb-btn:hover:not(:disabled) { background: #f2f3f5; }
        .mb-btn:disabled, .mb-btn-primary:disabled { opacity: 0.55; cursor: default; }

        /* A paused entity is dimmed rather than hidden: on a real account you keep
           seeing what you switched off, which is how you remember to switch it on. */
        .mb-table tr[data-paused] td { opacity: 0.5; }
        .mb-toggle[data-off] { background: var(--m-line); }
        .mb-toggle[data-off]::after { transform: translateX(0); }
        button.mb-toggle { cursor: pointer; border: none; padding: 0; }

        .mb-daybar {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          padding: 10px 16px; border-bottom: 1px solid var(--m-line);
          background: var(--m-card);
        }
        .mb-day-label { font-size: 13px; font-weight: 600; }
        .mb-day-sub { font-size: 12px; color: var(--m-muted); }
        .mb-daybar-actions { margin-left: auto; display: flex; gap: 8px; }

        .mb-warn {
          margin: 12px 16px 0; padding: 10px 12px; border-radius: 8px;
          border: 1px solid #f0c36d; background: #fdf6e3;
          font-size: 12.5px; color: #7a5b00;
        }
        .mb-warn b { font-weight: 700; }

        .mb-empty {
          padding: 40px 16px; text-align: center; color: var(--m-muted); font-size: 13px;
        }

        .mb-busy { opacity: 0.6; pointer-events: none; }

        .mb-search {
          display: inline-flex; align-items: center; gap: 6px;
          border: 1px solid var(--m-line); border-radius: 6px; padding: 0 8px;
          background: var(--m-card); color: var(--m-muted);
        }
        .mb-search input {
          font: inherit; font-size: 12.5px; border: none; outline: none; background: none;
          padding: 7px 0; width: 150px; color: var(--m-ink);
        }
        .mb-search:focus-within { border-color: var(--m-blue); }

        /* The whole header is the sort control, so the hit target matches the label. */
        .mb-sort {
          display: inline-flex; align-items: center; gap: 4px;
          font: inherit; color: inherit; background: none; border: none; padding: 0;
          cursor: pointer;
        }
        .mb-table th.num .mb-sort { flex-direction: row-reverse; }
        .mb-sort:hover { color: var(--m-blue); }

        @media (prefers-reduced-motion: reduce) {
          .mb-shell *, .mb-shell *::after { transition: none !important; }
        }
      `}</style>
  );
}
