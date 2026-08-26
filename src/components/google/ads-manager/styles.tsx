'use client';

/**
 * The Google Ads skin.
 *
 * A separate surface from the Meta one on purpose, and not because it would have
 * been hard to share. The two products look and feel genuinely different — Google's
 * is white, roomier, blue-accented, built around a left-hand tree rather than a
 * flat campaign list — and a learner who will open the real thing on Monday should
 * be building muscle memory for the real thing, not for a house style that
 * flattens both platforms into one.
 *
 * Scoped under `.ga-shell`, so none of it leaks into the surrounding app, which
 * keeps its own neo-brutalist system. The shell never claims to be Google's
 * product; it is a recreation a learner practises in.
 */
export function GoogleAdsStyles() {
  return (
    <style>{`
      .ga-shell {
        --g-bg: #ffffff;
        --g-ground: #f8f9fa;
        --g-line: #dadce0;
        --g-line-soft: #e8eaed;
        --g-ink: #202124;
        --g-muted: #5f6368;
        --g-faint: #80868b;
        --g-blue: #1a73e8;
        --g-blue-soft: #e8f0fe;
        --g-green: #188038;
        --g-amber: #e37400;
        --g-red: #d93025;
        position: relative;
        background: var(--g-bg);
        color: var(--g-ink);
        font-family: "Google Sans", Roboto, -apple-system, "Segoe UI", Arial, sans-serif;
        display: grid;
        grid-template-columns: 232px 1fr;
        min-height: 660px;
        border: 1px solid var(--g-line);
        border-radius: 10px;
        overflow: hidden;
        font-size: 13px;
      }
      .ga-shell * { box-sizing: border-box; }
      @media (max-width: 900px) {
        .ga-shell { grid-template-columns: 1fr; }
        .ga-side { display: none; }
      }

      /* ── left tree ─────────────────────────────────────────────────── */
      .ga-side { background: var(--g-bg); border-right: 1px solid var(--g-line); padding: 14px 0 20px; }
      .ga-acct { padding: 0 16px 14px; border-bottom: 1px solid var(--g-line-soft); margin-bottom: 10px; }
      .ga-acct-name { font-weight: 600; font-size: 14px; line-height: 1.3; }
      .ga-acct-sub { color: var(--g-muted); font-size: 11.5px; margin-top: 3px; }

      .ga-nav-label {
        padding: 12px 16px 5px; font-size: 10.5px; font-weight: 600;
        letter-spacing: .08em; text-transform: uppercase; color: var(--g-faint);
      }
      .ga-nav-item {
        display: flex; align-items: center; gap: 9px; width: 100%;
        padding: 8px 16px; border: none; background: none; cursor: pointer;
        font: 400 13px/1.3 inherit; color: var(--g-ink); text-align: left;
        border-left: 3px solid transparent;
      }
      .ga-nav-item:hover { background: var(--g-ground); }
      .ga-nav-on { background: var(--g-blue-soft); border-left-color: var(--g-blue); color: var(--g-blue); font-weight: 600; }
      .ga-nav-on:hover { background: var(--g-blue-soft); }
      .ga-nav-item[data-paused="true"] .ga-nav-text { color: var(--g-faint); }
      .ga-nav-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ga-nav-spend { font-size: 11px; color: var(--g-muted); font-variant-numeric: tabular-nums; }
      .ga-type-chip {
        display: inline-block; padding: 1px 6px; border-radius: 4px;
        font-size: 10px; font-weight: 600; letter-spacing: .02em;
        background: var(--g-ground); color: var(--g-muted); border: 1px solid var(--g-line-soft);
      }
      .ga-type-search { background: var(--g-blue-soft); color: var(--g-blue); border-color: #d2e3fc; }
      .ga-type-pmax   { background: #fef7e0; color: var(--g-amber); border-color: #feefc3; }
      .ga-type-app    { background: #e6f4ea; color: var(--g-green); border-color: #ceead6; }

      /* ── main ──────────────────────────────────────────────────────── */
      .ga-main { padding: 18px 22px 26px; min-width: 0; }
      .ga-topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
      .ga-title { font-size: 20px; font-weight: 500; line-height: 1.2; }
      .ga-crumb { color: var(--g-muted); font-size: 11.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
      .ga-crumb button { background: none; border: none; padding: 0; color: var(--g-blue); cursor: pointer; font: inherit; }
      .ga-crumb button:hover { text-decoration: underline; }

      .ga-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .ga-select, .ga-btn {
        font: 400 12.5px/1 inherit; color: var(--g-ink); background: var(--g-bg);
        border: 1px solid var(--g-line); border-radius: 4px; padding: 7px 10px; cursor: pointer;
      }
      .ga-select:hover, .ga-btn:hover { background: var(--g-ground); }
      .ga-btn-primary {
        background: var(--g-blue); border-color: var(--g-blue); color: #fff; font-weight: 500;
      }
      .ga-btn-primary:hover { background: #1765cc; border-color: #1765cc; }
      .ga-btn:disabled, .ga-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
      .ga-btn-primary:disabled:hover { background: var(--g-blue); }

      /* ── KPI strip ─────────────────────────────────────────────────── */
      /* Flex rather than grid: a grid's last row leaves dead cells when the count
         does not divide evenly, and a strip of seven metrics rarely does. Flexed
         items stretch to fill whatever row they land on. */
      .ga-kpis {
        display: flex; flex-wrap: wrap;
        gap: 1px; background: var(--g-line-soft); border: 1px solid var(--g-line-soft);
        border-radius: 8px; overflow: hidden; margin-bottom: 18px;
      }
      .ga-kpi { background: var(--g-bg); padding: 12px 14px; flex: 1 1 122px; min-width: 122px; }
      .ga-kpi-l { font-size: 11px; color: var(--g-muted); margin-bottom: 4px; }
      .ga-kpi-v { font-size: 18px; font-weight: 500; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
      .ga-kpi-note { font-size: 10.5px; margin-top: 3px; color: var(--g-faint); }
      .ga-kpi-good .ga-kpi-v { color: var(--g-green); }
      .ga-kpi-bad .ga-kpi-v { color: var(--g-red); }

      /* ── tabs ──────────────────────────────────────────────────────── */
      .ga-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--g-line); margin-bottom: 14px; overflow-x: auto; }
      .ga-tab {
        border: none; background: none; cursor: pointer; white-space: nowrap;
        font: 500 13px/1 inherit; color: var(--g-muted);
        padding: 11px 14px; border-bottom: 3px solid transparent; margin-bottom: -1px;
      }
      .ga-tab:hover { color: var(--g-ink); background: var(--g-ground); }
      .ga-tab-on { color: var(--g-blue); border-bottom-color: var(--g-blue); }

      /* ── tables ────────────────────────────────────────────────────── */
      .ga-tablewrap { overflow-x: auto; border: 1px solid var(--g-line-soft); border-radius: 8px; }
      .ga-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      .ga-table th {
        text-align: left; font-weight: 500; color: var(--g-muted); font-size: 11px;
        padding: 9px 10px; border-bottom: 1px solid var(--g-line); white-space: nowrap;
        background: var(--g-ground); position: sticky; top: 0;
      }
      .ga-table td { padding: 9px 10px; border-bottom: 1px solid var(--g-line-soft); vertical-align: middle; }
      .ga-table tbody tr:last-child td { border-bottom: none; }
      .ga-table tbody tr:hover { background: #fafbfc; }
      .ga-table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .ga-table tfoot td {
        border-top: 2px solid var(--g-line); font-weight: 600; background: var(--g-ground);
        padding: 10px; font-variant-numeric: tabular-nums;
      }
      .ga-row-paused td:not(.ga-actions) { opacity: .52; }
      .ga-name { font-weight: 500; }
      /* Keyword text does not wrap. A keyword broken across four lines is unreadable
         as a keyword, and the row it sits in stops being scannable — which matters
         more here than saving horizontal space, since the table scrolls anyway. */
      .ga-kw { white-space: nowrap; }
      .ga-table td:has(.ga-kw) { min-width: 190px; }
      .ga-sub { display: block; color: var(--g-muted); font-size: 11px; margin-top: 2px; }
      .ga-linky { background: none; border: none; padding: 0; color: var(--g-blue); cursor: pointer; font: inherit; text-align: left; }
      .ga-linky:hover { text-decoration: underline; }

      .ga-cell-edit {
        background: none; border: 1px solid transparent; border-radius: 4px;
        padding: 2px 6px; margin: -2px -6px; cursor: pointer; font: inherit;
        color: inherit; font-variant-numeric: tabular-nums;
      }
      .ga-cell-edit:hover { border-color: var(--g-line); background: var(--g-bg); }

      /* status dots, the way the real interface flags a keyword */
      .ga-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
      .ga-dot-ok { background: var(--g-green); }
      .ga-dot-warn { background: var(--g-amber); }
      .ga-dot-bad { background: var(--g-red); }
      .ga-dot-off { background: var(--g-faint); }

      .ga-qs { display: inline-flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
      .ga-qs-bar { width: 34px; height: 5px; border-radius: 3px; background: var(--g-line-soft); overflow: hidden; }
      .ga-qs-fill { display: block; height: 100%; border-radius: 3px; }

      /* impression-share split bar: won / lost to rank / lost to budget */
      .ga-isbar { display: flex; height: 6px; width: 74px; border-radius: 3px; overflow: hidden; background: var(--g-line-soft); }
      .ga-is-won { background: var(--g-blue); }
      .ga-is-rank { background: var(--g-amber); }
      .ga-is-budget { background: var(--g-red); }

      .ga-empty { padding: 34px 20px; text-align: center; color: var(--g-muted); font-size: 13px; }
      .ga-empty-title { font-weight: 500; color: var(--g-ink); margin-bottom: 5px; font-size: 14px; }

      .ga-note {
        border: 1px solid var(--g-line); border-left: 3px solid var(--g-blue);
        background: var(--g-ground); border-radius: 6px; padding: 11px 13px;
        font-size: 12.5px; line-height: 1.55; color: var(--g-ink); margin-bottom: 14px;
      }
      .ga-note-amber { border-left-color: var(--g-amber); }
      .ga-note-red { border-left-color: var(--g-red); }
      .ga-note b { font-weight: 600; }

      .ga-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
      .ga-chip {
        font: 400 12px/1 inherit; padding: 6px 11px; border-radius: 16px;
        border: 1px solid var(--g-line); background: var(--g-bg); cursor: pointer; color: var(--g-ink);
      }
      .ga-chip:hover { background: var(--g-ground); }
      .ga-chip-on { background: var(--g-blue-soft); border-color: #d2e3fc; color: var(--g-blue); font-weight: 500; }

      /* ── the day clock ─────────────────────────────────────────────── */
      .ga-clock {
        display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        border: 1px solid var(--g-line); border-radius: 8px; padding: 10px 13px;
        background: var(--g-ground); margin-bottom: 16px;
      }
      .ga-clock-day { font-weight: 600; font-size: 13px; }
      .ga-clock-note { color: var(--g-muted); font-size: 11.5px; flex: 1; min-width: 160px; }

      /* ── inline editor popover ─────────────────────────────────────── */
      .ga-pop {
        position: absolute; z-index: 50; background: var(--g-bg);
        border: 1px solid var(--g-line); border-radius: 8px; padding: 14px;
        box-shadow: 0 8px 26px rgba(32,33,36,.22); min-width: 230px;
      }
      .ga-pop-label { font-size: 11px; color: var(--g-muted); margin-bottom: 6px; }
      .ga-input {
        width: 100%; font: 400 13px/1 inherit; padding: 8px 10px;
        border: 1px solid var(--g-line); border-radius: 4px; color: var(--g-ink); background: var(--g-bg);
      }
      .ga-input:focus { outline: 2px solid var(--g-blue); outline-offset: -1px; border-color: var(--g-blue); }
      .ga-pop-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
      .ga-backdrop { position: fixed; inset: 0; z-index: 40; background: transparent; border: none; padding: 0; cursor: default; }

      .ga-err {
        border: 1px solid #f5c6cb; background: #fdecea; color: #611a15;
        border-radius: 6px; padding: 10px 12px; font-size: 12.5px; margin-bottom: 12px;
      }
    `}</style>
  );
}
