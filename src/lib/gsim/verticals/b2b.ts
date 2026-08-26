import type { SearchQuery } from '../engine/types';

/**
 * The searches that exist in Ledgerline's market.
 *
 * Deliberately not a rescaled copy of the D2C universe. B2B search is a different
 * animal and the differences are the lesson:
 *
 *   - **Volume is tiny and clicks are expensive.** A hundred searches a day at
 *     ₹300 a click. There is no "just get more traffic" lever, so the only thing
 *     left is precision — which is why B2B accounts are built exact-match-first.
 *
 *   - **Competitor queries are the best inventory, not waste.** Somebody typing
 *     "tally alternative" is further along than somebody typing "accounting
 *     software". In D2C, competitor terms convert at a fifth of brand; here they
 *     are among the strongest non-brand terms in the account, and a learner who
 *     carries the D2C instinct over will negate their best keyword.
 *
 *   - **The waste is students and job-seekers.** "Accounting software" pulls in
 *     people studying accounting, people looking for accounting jobs, and people
 *     wanting a free Excel template. All three read as commercial intent and none
 *     of them will ever book a demo. This is the single biggest hole in an
 *     untended B2B account and it is invisible unless you read search terms.
 *
 *   - **Your own brand is not automatically good.** "Ledgerline login" and
 *     "Ledgerline support" are your existing customers, and paying to send them to
 *     a page they were going to reach anyway is a real and common leak.
 *
 * The conversion is a booked demo. Not a sale — which is the other thing that has
 * to be felt rather than told, because it is why a B2B account can look superb on
 * conversions and still lose money.
 */

const q = (
  id: string,
  text: string,
  volume: number,
  intent: SearchQuery['intent'],
  concepts: string[],
  cvrMultiplier: number,
  competition: number,
  brand = false,
  related: string[] = [],
): SearchQuery => ({ id, text, volume, intent, concepts, cvrMultiplier, competition, brand, related });

export const B2B_QUERIES: SearchQuery[] = [
  // ── Brand. Not all of it is worth having. ────────────────────────────────
  q('b1', 'ledgerline', 88, 'navigational', ['ledgerline'], 1.1, 0.4, true),
  q('b2', 'ledgerline pricing', 55, 'transactional', ['ledgerline', 'pricing'], 1.4, 0.5, true),
  q('b3', 'ledgerline demo', 31, 'transactional', ['ledgerline', 'demo'], 2.2, 0.4, true),
  q('b4', 'ledgerline reviews', 37, 'commercial', ['ledgerline', 'reviews'], 0.85, 0.6, true),
  // Existing customers. You are paying for a click you already own.
  q('b5', 'ledgerline login', 143, 'navigational', ['ledgerline', 'login'], 0.02, 0.2, true),
  q('b6', 'ledgerline support', 50, 'navigational', ['ledgerline', 'support'], 0.02, 0.2, true),
  q('b7', 'ledgerline careers', 40, 'informational', ['ledgerline', 'careers'], 0.0, 0.1, true),

  // ── High intent. Small, expensive, and where the pipeline comes from. ────
  q('t1', 'accounting software for small business', 109, 'transactional', ['accounting', 'software', 'small', 'business'], 1.05, 1.7),
  q('t2', 'gst billing software for business', 82, 'transactional', ['gst', 'billing', 'software', 'business'], 1.2, 1.6),
  q('t3', 'cloud accounting software india', 46, 'transactional', ['cloud', 'accounting', 'software', 'india'], 1.35, 1.4),
  q('t4', 'buy accounting software online', 29, 'transactional', ['buy', 'accounting', 'software', 'online'], 1.1, 1.5),
  q('t5', 'accounting software pricing plans', 34, 'transactional', ['accounting', 'software', 'pricing', 'plans'], 1.3, 1.3),
  q('t6', 'book demo accounting software', 14, 'transactional', ['book', 'demo', 'accounting', 'software'], 2.4, 1.1),
  q('t7', 'gst filing software for ca firms', 19, 'transactional', ['gst', 'filing', 'software', 'ca', 'firms'], 1.9, 1.0),
  q('t8', 'multi user accounting software', 22, 'transactional', ['multi', 'user', 'accounting', 'software'], 1.45, 1.1),

  // ── Competitor. In B2B these are the strongest non-brand terms there are. ─
  q('x1', 'tally alternative', 101, 'commercial', ['tally', 'alternative'], 1.8, 1.8),
  q('x2', 'zoho books alternative', 55, 'commercial', ['zoho', 'books', 'alternative'], 1.75, 1.6),
  q('x3', 'tally vs zoho books', 76, 'commercial', ['tally', 'zoho', 'books'], 1.15, 1.5),
  q('x4', 'quickbooks india alternative', 40, 'commercial', ['quickbooks', 'india', 'alternative'], 1.7, 1.5),
  q('x5', 'best tally competitor software', 27, 'commercial', ['tally', 'competitor', 'software'], 1.6, 1.4),
  q('x6', 'busy accounting software review', 37, 'commercial', ['busy', 'accounting', 'software', 'review'], 0.95, 1.2, false, ['accounting', 'software', 'tally']),
  q('x7', 'marg erp vs tally', 30, 'commercial', ['marg', 'erp', 'tally'], 1.0, 1.2, false, ['accounting', 'software']),
  q('x8', 'switch from tally to cloud', 16, 'transactional', ['switch', 'tally', 'cloud'], 2.1, 1.0),

  // ── Comparison and research. Real buyers, earlier. ───────────────────────
  q('c1', 'best accounting software india', 176, 'commercial', ['accounting', 'software', 'india'], 0.85, 1.7),
  q('c2', 'accounting software comparison', 69, 'commercial', ['accounting', 'software', 'comparison'], 0.95, 1.4),
  q('c3', 'gst software for small business', 97, 'commercial', ['gst', 'software', 'small', 'business'], 1.0, 1.5),
  q('c4', 'inventory and accounting software', 59, 'commercial', ['inventory', 'accounting', 'software'], 0.9, 1.3),
  q('c5', 'accounting software for manufacturing', 32, 'commercial', ['accounting', 'software', 'manufacturing'], 1.15, 1.1),
  q('c6', 'accounting software for retail shop', 50, 'commercial', ['accounting', 'software', 'retail', 'shop'], 0.8, 1.2),
  q('c7', 'e invoicing software india', 39, 'commercial', ['invoicing', 'software', 'india'], 1.05, 1.3),
  q('c8', 'accounting software with gst return filing', 24, 'commercial', ['accounting', 'software', 'gst', 'return', 'filing'], 1.4, 1.1),

  // ── The generic trap. Volume that reads commercial and is not. ───────────
  q('g1', 'accounting software', 567, 'commercial', ['accounting', 'software'], 0.28, 1.9),
  q('g2', 'accounting', 882, 'informational', ['accounting'], 0.04, 1.2, false, ['software', 'billing', 'invoice', 'bookkeeping']),
  q('g3', 'billing software', 370, 'commercial', ['billing', 'software'], 0.3, 1.6),
  q('g4', 'erp software', 269, 'commercial', ['erp', 'software'], 0.22, 1.7, false, ['accounting', 'software', 'billing']),
  q('g5', 'bookkeeping', 218, 'informational', ['bookkeeping'], 0.05, 0.9, false, ['accounting', 'software']),
  q('g6', 'invoice software', 294, 'commercial', ['invoice', 'software'], 0.32, 1.5, false, ['billing', 'accounting', 'software']),

  // ── Free. The most expensive word in B2B search. ─────────────────────────
  q('f1', 'free accounting software', 403, 'transactional', ['free', 'accounting', 'software'], 0.05, 1.3),
  q('f2', 'free gst billing software download', 302, 'transactional', ['free', 'gst', 'billing', 'software', 'download'], 0.03, 1.2),
  q('f3', 'open source accounting software', 160, 'commercial', ['open', 'source', 'accounting', 'software'], 0.04, 0.8),
  q('f4', 'accounting software free trial', 88, 'transactional', ['accounting', 'software', 'free', 'trial'], 0.75, 1.4),
  q('f5', 'excel accounting template free', 269, 'transactional', ['excel', 'accounting', 'template', 'free'], 0.01, 0.6, false, ['accounting', 'software', 'billing']),
  q('f6', 'tally crack download', 172, 'transactional', ['tally', 'crack', 'download'], 0.0, 0.3, false, ['accounting', 'software']),

  // ── Students and job-seekers. B2B's biggest invisible leak. ──────────────
  q('s1', 'accounting course online', 349, 'commercial', ['accounting', 'course', 'online'], 0.01, 1.4, false, ['accounting', 'software']),
  q('s2', 'tally course fees', 235, 'commercial', ['tally', 'course', 'fees'], 0.0, 1.1, false, ['accounting', 'software']),
  q('s3', 'accountant salary in india', 290, 'informational', ['accountant', 'salary', 'india'], 0.0, 0.4, false, ['accounting', 'software']),
  q('s4', 'accounting jobs bangalore', 202, 'informational', ['accounting', 'jobs', 'bangalore'], 0.0, 0.6, false, ['accounting', 'software']),
  q('s5', 'what is double entry bookkeeping', 143, 'informational', ['double', 'entry', 'bookkeeping'], 0.0, 0.3, false, ['accounting', 'software']),
  q('s6', 'how to become a chartered accountant', 218, 'informational', ['become', 'chartered', 'accountant'], 0.0, 0.5, false, ['accounting', 'software']),
  q('s7', 'accounting software full form', 55, 'informational', ['accounting', 'software', 'full', 'form'], 0.0, 0.2),
  q('s8', 'balance sheet format', 256, 'informational', ['balance', 'sheet', 'format'], 0.0, 0.3, false, ['accounting', 'software']),

  // ── Informational, but genuinely adjacent. Cheap, occasionally worth it. ─
  q('i1', 'how to file gst return', 374, 'informational', ['file', 'gst', 'return'], 0.08, 0.7, false, ['gst', 'software', 'accounting']),
  q('i2', 'gst return due date', 311, 'informational', ['gst', 'return', 'due', 'date'], 0.02, 0.5, false, ['gst', 'software', 'accounting']),
  q('i3', 'what is e invoicing', 109, 'informational', ['invoicing'], 0.12, 0.6),
  q('i4', 'how to migrate accounting data', 31, 'informational', ['migrate', 'accounting', 'data'], 0.42, 0.6),
  q('i5', 'difference between erp and accounting software', 50, 'informational', ['difference', 'erp', 'accounting', 'software'], 0.25, 0.6),

  // ── The long tail. Tiny, specific, and worth several times the average. ──
  q('l1', 'cloud accounting software for ca firm with multi client', 6, 'transactional', ['cloud', 'accounting', 'software', 'ca', 'firm', 'multi', 'client'], 2.6, 0.5),
  q('l2', 'gst compliant billing software for textile wholesaler', 4, 'transactional', ['gst', 'billing', 'software', 'textile', 'wholesaler'], 2.4, 0.4),
  q('l3', 'accounting software that integrates with shopify india', 7, 'transactional', ['accounting', 'software', 'integrates', 'shopify', 'india'], 2.2, 0.6),
  q('l4', 'migrate from tally to cloud accounting without data loss', 5, 'transactional', ['migrate', 'tally', 'cloud', 'accounting', 'data', 'loss'], 2.5, 0.4),
  q('l5', 'accounting software with role based access for finance team', 4, 'commercial', ['accounting', 'software', 'role', 'based', 'access', 'finance', 'team'], 2.1, 0.5),
  q('l6', 'multi branch inventory accounting software india', 5, 'commercial', ['multi', 'branch', 'inventory', 'accounting', 'software', 'india'], 1.95, 0.6),
];

/** Search volume here is a fraction of a consumer market's, and clicks cost
 *  several times as much. Both facts are set deliberately: the whole reason to
 *  offer a second vertical is that "just spend more" is not available in it, so
 *  precision is the only lever left. */
export const B2B_TOTAL_VOLUME = B2B_QUERIES.reduce((n, x) => n + x.volume, 0);
