import type { SearchQuery } from '../engine/types';

/**
 * The searches that exist in NORTHBOUND's market.
 *
 * Same fictional brand as the Meta course on purpose. A learner who has run its
 * Facebook account and then opens its Google account gets a genuinely instructive
 * comparison: same product, same margin, and they can feel why one converts at 2%
 * off a scroll and the other at 5% off a search, and why the clicks cost four
 * times as much.
 *
 * The universe is authored rather than generated because its *shape* is the
 * lesson. It contains, deliberately:
 *
 *   - a small number of high-volume generic queries that look attractive and
 *     convert badly, which is what a naive keyword list buys;
 *   - a long tail of specific, low-volume queries that convert several times
 *     better, which is what a search terms report exists to find;
 *   - genuine waste — repairs, jobs, free, second-hand, competitor names — that
 *     only broad match reaches, and only negatives remove;
 *   - brand searches, cheap and excellent, which Performance Max will claim.
 *
 * `concepts` is the matching vocabulary, not the words. Tokens are shared
 * deliberately across related queries so broad match reaches between them the way
 * it really does.
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

export const D2C_QUERIES: SearchQuery[] = [
  // ── Brand. Cheap, excellent, and finite. ─────────────────────────────────
  //
  // Finite is the operative word. Roughly five hundred brand searches a day for a
  // brand at this stage, against twenty-two thousand non-brand ones — which is why
  // an account can look magnificent on blended numbers and be losing money on
  // every single thing it actually bought.
  q('b1', 'northbound', 185, 'navigational', ['northbound'], 1.9, 0.5, true),
  q('b2', 'northbound shoes', 115, 'navigational', ['northbound', 'shoes'], 2.2, 0.6, true),
  q('b3', 'northbound running shoes', 62, 'navigational', ['northbound', 'running', 'shoes'], 2.4, 0.6, true),
  q('b4', 'northbound trail runner review', 42, 'commercial', ['northbound', 'trail', 'runner', 'review'], 1.4, 0.7, true),
  q('b5', 'northbound discount code', 80, 'transactional', ['northbound', 'discount', 'code'], 1.7, 0.5, true),

  // ── Transactional core. Expensive, contested, and where the money is. ────
  q('t1', 'buy running shoes online', 310, 'transactional', ['buy', 'running', 'shoes', 'online'], 1.25, 1.6),
  q('t2', 'running shoes price', 240, 'transactional', ['running', 'shoes', 'price'], 1.05, 1.5),
  q('t3', 'buy trail running shoes', 130, 'transactional', ['buy', 'trail', 'running', 'shoes'], 1.5, 1.3),
  q('t4', 'waterproof running shoes buy', 85, 'transactional', ['waterproof', 'running', 'shoes', 'buy'], 1.75, 1.1),
  q('t5', 'order running shoes online india', 110, 'transactional', ['order', 'running', 'shoes', 'online', 'india'], 1.3, 1.4),
  q('t6', 'running shoes online shopping', 195, 'transactional', ['running', 'shoes', 'online', 'shopping'], 1.1, 1.5),
  q('t7', 'buy sneakers online', 280, 'transactional', ['buy', 'sneakers', 'online'], 0.85, 1.7, false, ['shoes', 'running']),
  q('t8', 'trail shoes for monsoon buy', 62, 'transactional', ['trail', 'shoes', 'monsoon', 'buy'], 1.95, 0.8),
  q('t9', 'buy waterproof trail shoes india', 48, 'transactional', ['buy', 'waterproof', 'trail', 'shoes', 'india'], 2.1, 0.9),
  q('t10', 'running shoes for flat feet buy', 55, 'transactional', ['running', 'shoes', 'flat', 'feet', 'buy'], 1.85, 0.9),

  // ── Commercial. Comparing, not yet buying. Cheaper, converts respectably. ─
  q('c1', 'best running shoes india', 640, 'commercial', ['running', 'shoes', 'india'], 0.9, 1.4),
  q('c2', 'best trail running shoes', 380, 'commercial', ['trail', 'running', 'shoes'], 1.15, 1.2),
  q('c3', 'running shoes for flat feet', 290, 'commercial', ['running', 'shoes', 'flat', 'feet'], 1.35, 1.0),
  q('c4', 'waterproof running shoes', 210, 'commercial', ['waterproof', 'running', 'shoes'], 1.4, 1.0),
  q('c5', 'running shoes for monsoon', 175, 'commercial', ['running', 'shoes', 'monsoon'], 1.5, 0.8),
  q('c6', 'trail running shoes vs road', 120, 'commercial', ['trail', 'running', 'shoes', 'road'], 0.75, 0.7),
  q('c7', 'running shoes for marathon training', 145, 'commercial', ['running', 'shoes', 'marathon', 'training'], 1.2, 0.9),
  q('c8', 'lightweight running shoes', 230, 'commercial', ['lightweight', 'running', 'shoes'], 1.0, 1.1),
  q('c9', 'running shoes with arch support', 165, 'commercial', ['running', 'shoes', 'arch', 'support'], 1.45, 0.9),
  q('c10', 'durable trail shoes for hiking', 88, 'commercial', ['durable', 'trail', 'shoes', 'hiking'], 0.95, 0.7),
  q('c11', 'running shoes under 5000', 310, 'commercial', ['running', 'shoes', 'under', '5000'], 0.7, 1.3),
  q('c12', 'sneakers for daily wear', 260, 'commercial', ['sneakers', 'daily', 'wear'], 0.6, 1.0, false, ['shoes', 'running']),

  // ── The generic trap. Enormous volume, terrible economics. ───────────────
  q('g1', 'shoes', 2400, 'commercial', ['shoes'], 0.18, 1.9, false, ['running', 'sneakers', 'footwear', 'trainers']),
  q('g2', 'running shoes', 1850, 'commercial', ['running', 'shoes'], 0.45, 1.8),
  q('g3', 'sneakers', 1600, 'commercial', ['sneakers'], 0.2, 1.7, false, ['shoes', 'running', 'footwear']),
  q('g4', 'trainers', 720, 'commercial', ['trainers'], 0.22, 1.4, false, ['running', 'shoes', 'sneakers', 'footwear']),
  q('g5', 'footwear', 980, 'commercial', ['footwear'], 0.15, 1.5, false, ['shoes', 'running', 'sneakers', 'trainers']),
  q('g6', 'shoes online', 1100, 'commercial', ['shoes', 'online'], 0.35, 1.7, false, ['running', 'sneakers']),

  // ── Informational. Cheap clicks, almost no conversions. ──────────────────
  q('i1', 'how to choose running shoes', 480, 'informational', ['choose', 'running', 'shoes'], 0.5, 0.6),
  q('i2', 'how to clean running shoes', 390, 'informational', ['clean', 'running', 'shoes'], 0.12, 0.4),
  q('i3', 'when to replace running shoes', 260, 'informational', ['replace', 'running', 'shoes'], 0.35, 0.5),
  q('i4', 'running shoes size guide', 340, 'informational', ['running', 'shoes', 'size', 'guide'], 0.6, 0.6),
  q('i5', 'what is drop in running shoes', 180, 'informational', ['drop', 'running', 'shoes'], 0.25, 0.4),
  q('i6', 'are trail shoes good for road running', 150, 'informational', ['trail', 'shoes', 'road', 'running'], 0.3, 0.4),
  q('i7', 'history of running shoes', 90, 'informational', ['history', 'running', 'shoes'], 0.02, 0.2),
  q('i8', 'running shoes wikipedia', 70, 'informational', ['running', 'shoes', 'wikipedia'], 0.01, 0.2),

  // ── Genuine waste. Only broad match reaches these. ───────────────────────
  q('w1', 'running shoes repair near me', 210, 'transactional', ['running', 'shoes', 'repair'], 0.02, 0.5),
  q('w2', 'shoe repair shop', 340, 'transactional', ['shoe', 'repair', 'shop'], 0.01, 0.5, false, ['shoes', 'running']),
  q('w3', 'free running shoes', 190, 'transactional', ['free', 'running', 'shoes'], 0.02, 0.6),
  q('w4', 'second hand running shoes', 160, 'transactional', ['second', 'hand', 'running', 'shoes'], 0.05, 0.6),
  q('w5', 'used sneakers cheap', 240, 'transactional', ['used', 'sneakers', 'cheap'], 0.04, 0.7, false, ['shoes', 'running']),
  q('w6', 'running shoes jobs', 85, 'informational', ['running', 'shoes', 'jobs'], 0.0, 0.3),
  q('w7', 'shoe store salary india', 110, 'informational', ['shoe', 'store', 'salary'], 0.0, 0.3, false, ['shoes', 'running', 'sneakers']),
  q('w8', 'how to make shoes at home', 130, 'informational', ['make', 'shoes', 'home'], 0.0, 0.3, false, ['running', 'sneakers', 'footwear']),
  q('w9', 'running shoes wholesale supplier', 95, 'transactional', ['running', 'shoes', 'wholesale', 'supplier'], 0.03, 0.6),
  q('w10', 'rent running shoes', 45, 'transactional', ['rent', 'running', 'shoes'], 0.01, 0.3),
  q('w11', 'kids school shoes', 520, 'commercial', ['kids', 'school', 'shoes'], 0.03, 1.2, false, ['running', 'footwear', 'sneakers']),
  q('w12', 'formal shoes for men', 680, 'commercial', ['formal', 'shoes', 'men'], 0.02, 1.3, false, ['running', 'footwear', 'sneakers']),
  q('w13', 'football boots online', 290, 'transactional', ['football', 'boots', 'online'], 0.02, 1.1, false, ['shoes', 'footwear', 'sneakers', 'running']),
  q('w14', 'running shoes discount coupon free', 175, 'transactional', ['running', 'shoes', 'discount', 'coupon', 'free'], 0.15, 0.8),

  // ── Competitors. A deliberate decision, not an accident. ─────────────────
  q('x1', 'nike running shoes', 1400, 'commercial', ['nike', 'running', 'shoes'], 0.22, 1.9),
  q('x2', 'adidas trail shoes', 620, 'commercial', ['adidas', 'trail', 'shoes'], 0.25, 1.7),
  q('x3', 'asics vs nike running shoes', 240, 'commercial', ['asics', 'nike', 'running', 'shoes'], 0.3, 1.2),
  q('x4', 'decathlon running shoes', 780, 'commercial', ['decathlon', 'running', 'shoes'], 0.28, 1.5),

  // ── The long tail. Small, specific, and several times better than average. ─
  q('l1', 'waterproof trail running shoes for indian monsoon', 22, 'transactional', ['waterproof', 'trail', 'running', 'shoes', 'monsoon'], 2.6, 0.4),
  q('l2', 'wide fit trail running shoes india', 18, 'transactional', ['wide', 'fit', 'trail', 'running', 'shoes', 'india'], 2.4, 0.4),
  q('l3', 'running shoes for overpronation flat feet', 26, 'commercial', ['running', 'shoes', 'overpronation', 'flat', 'feet'], 2.1, 0.5),
  q('l4', 'best cushioned running shoes for heavy runners', 31, 'commercial', ['cushioned', 'running', 'shoes', 'heavy', 'runners'], 1.9, 0.6),
  q('l5', 'trail shoes with grip for wet rocks', 15, 'commercial', ['trail', 'shoes', 'grip', 'wet', 'rocks'], 2.3, 0.3),
  q('l6', 'lightweight waterproof running shoes size 9', 12, 'transactional', ['lightweight', 'waterproof', 'running', 'shoes', 'size'], 2.5, 0.3),
  q('l7', 'running shoes for beginners marathon india', 34, 'commercial', ['running', 'shoes', 'beginners', 'marathon', 'india'], 1.7, 0.6),
  q('l8', 'breathable running shoes for humid weather', 28, 'commercial', ['breathable', 'running', 'shoes', 'humid', 'weather'], 1.8, 0.5),
];

/** Total addressable searches per day, for sanity-checking a scenario's scale. */
export const D2C_TOTAL_VOLUME = D2C_QUERIES.reduce((n, x) => n + x.volume, 0);
