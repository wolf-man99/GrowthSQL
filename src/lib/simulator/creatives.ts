/**
 * The creative library.
 *
 * Creative is the biggest lever in paid social (Learn module 3), so the simulator
 * cannot treat ads as interchangeable rectangles. Each asset here carries hidden
 * performance attributes that the engine reads, and a visual spec that the UI
 * renders, so choosing between them is a real decision with real consequences.
 *
 * Two deliberate choices:
 *
 * 1. The attributes are never shown in the UI. On a real account nobody hands you
 *    a creative's fatigue rate; you infer it from performance. Exposing them would
 *    turn module 3 from a judgement exercise into a lookup.
 *
 * 2. The visuals are generated vector compositions, not photographs. The account
 *    belongs to a fictional brand, and rendering mock ad frames from a palette and
 *    a layout keeps that honest, ships nothing binary, themes cleanly, and cannot
 *    be mistaken for a real brand's advertising.
 */

import type { AdFormat, CreativeAttributes } from './engine/types';

export type CreativeLayout =
  | 'ugc-portrait'
  | 'product-hero'
  | 'lookbook-grid'
  | 'offer-slab'
  | 'testimonial-card'
  | 'catalog-tiles';

export interface CreativeVisual {
  layout: CreativeLayout;
  /** Two-stop palette the renderer builds the frame from. */
  palette: [string, string];
  /** Words burned into the mock frame, kept very short to read at thumbnail size. */
  overlay: string;
  /** Optional kicker line, rendered small above the overlay. */
  kicker?: string;
}

export interface Creative extends CreativeAttributes {
  id: string;
  name: string;
  format: AdFormat;
  /** One-line description of the concept, shown in the picker. This is the *brief*,
   *  not the performance data: it tells a learner what the ad is, not how it does. */
  concept: string;
  visual: CreativeVisual;
}

/**
 * Attribute ranges are calibrated so the library spans the trade-offs the
 * curriculum teaches, rather than containing one obviously-best asset:
 *
 *   baseCtrMultiplier  0.85 – 1.35   how well it earns the click at all
 *   fatigueRate        0.16 – 0.46   how fast it wears out (lower lasts longer)
 *   coldAffinity       0.70 – 1.25   >1 works on strangers, <1 needs prior context
 *   hookStrength       0.80 – 1.30   first-3-seconds pull, also an auction signal
 *
 * The instructive pairing is `offer-slab` against `ugc-street`: the discount slab
 * out-clicks everything for about a week and then falls off a cliff, while the UGC
 * video starts lower and is still working a month later. A learner who scales the
 * slab and stops there learns module 6.1 the expensive way.
 */
export const CREATIVES: Creative[] = [
  {
    id: 'cr-ugc-street',
    name: 'UGC: street styling',
    format: 'video',
    concept: 'Customer films themselves styling three pieces on the street. Unpolished, shot on a phone.',
    visual: { layout: 'ugc-portrait', palette: ['#1f2933', '#c8553d'], overlay: 'styled 3 ways', kicker: 'real customer' },
    baseCtrMultiplier: 1.18, fatigueRate: 0.17, coldAffinity: 1.22, hookStrength: 1.24,
  },
  {
    id: 'cr-ugc-switch',
    name: 'UGC: why I switched',
    format: 'video',
    concept: 'Talking-head testimonial opening on the objection, not the product.',
    visual: { layout: 'testimonial-card', palette: ['#25303b', '#e0a458'], overlay: 'why I switched', kicker: 'unscripted' },
    baseCtrMultiplier: 1.24, fatigueRate: 0.20, coldAffinity: 1.15, hookStrength: 1.30,
  },
  {
    id: 'cr-founder',
    name: 'Founder story',
    format: 'video',
    concept: 'Founder explains why the brand exists. Builds trust with people who have never heard of you.',
    visual: { layout: 'testimonial-card', palette: ['#2b2118', '#b98b57'], overlay: 'why we started', kicker: 'founder' },
    baseCtrMultiplier: 1.02, fatigueRate: 0.22, coldAffinity: 1.25, hookStrength: 1.05,
  },
  {
    id: 'cr-lookbook',
    name: 'Static: lookbook grid',
    format: 'image',
    concept: 'Six-shot grid of the season. Beautiful, but asks the viewer to work out the offer.',
    visual: { layout: 'lookbook-grid', palette: ['#30323d', '#a6a6a8'], overlay: 'the new season' },
    baseCtrMultiplier: 0.88, fatigueRate: 0.34, coldAffinity: 1.05, hookStrength: 0.84,
  },
  {
    id: 'cr-hero',
    name: 'Static: product hero',
    format: 'image',
    concept: 'Single product, clean background, price visible.',
    visual: { layout: 'product-hero', palette: ['#f2f0eb', '#1f2933'], overlay: 'the everyday tee' },
    baseCtrMultiplier: 0.96, fatigueRate: 0.30, coldAffinity: 0.98, hookStrength: 0.92,
  },
  {
    id: 'cr-offer-slab',
    name: 'Offer: 20% off slab',
    format: 'image',
    concept: 'Big discount, big type, urgency. Enormous early click-through and a short shelf life.',
    visual: { layout: 'offer-slab', palette: ['#c1121f', '#fdf0d5'], overlay: '20% off', kicker: 'this week only' },
    baseCtrMultiplier: 1.34, fatigueRate: 0.46, coldAffinity: 1.02, hookStrength: 1.18,
  },
  {
    id: 'cr-carousel-best',
    name: 'Carousel: bestsellers',
    format: 'carousel',
    concept: 'Five bestsellers, each its own card. Lets the viewer self-select what they want.',
    visual: { layout: 'catalog-tiles', palette: ['#22333b', '#eae0d5'], overlay: 'bestsellers' },
    baseCtrMultiplier: 1.06, fatigueRate: 0.26, coldAffinity: 1.00, hookStrength: 0.98,
  },
  {
    id: 'cr-carousel-drop',
    name: 'Carousel: new drop',
    format: 'carousel',
    concept: 'This week’s release, card by card. Works on people already following the brand.',
    visual: { layout: 'catalog-tiles', palette: ['#1d3557', '#f1faee'], overlay: 'the drop', kicker: 'new in' },
    baseCtrMultiplier: 1.10, fatigueRate: 0.28, coldAffinity: 0.88, hookStrength: 1.02,
  },
  {
    id: 'cr-retarget-nudge',
    name: 'Retargeting: still thinking it over?',
    format: 'image',
    concept: 'Speaks directly to someone who left something in their cart. Meaningless to a stranger.',
    visual: { layout: 'offer-slab', palette: ['#344e41', '#dad7cd'], overlay: 'still thinking?', kicker: 'your cart' },
    baseCtrMultiplier: 1.28, fatigueRate: 0.32, coldAffinity: 0.70, hookStrength: 1.12,
  },
  {
    id: 'cr-collection',
    name: 'Collection: shop the look',
    format: 'collection',
    concept: 'Hero video over a shoppable product grid. Shortens the path from ad to cart.',
    visual: { layout: 'catalog-tiles', palette: ['#283618', '#fefae0'], overlay: 'shop the look' },
    baseCtrMultiplier: 1.12, fatigueRate: 0.24, coldAffinity: 0.94, hookStrength: 1.08,
  },
  {
    id: 'cr-dpa',
    name: 'Dynamic catalog',
    format: 'collection',
    concept: 'Meta assembles the frame per viewer from the product feed.',
    visual: { layout: 'catalog-tiles', palette: ['#3d405b', '#f4f1de'], overlay: 'picked for you' },
    baseCtrMultiplier: 1.15, fatigueRate: 0.19, coldAffinity: 0.82, hookStrength: 1.00,
  },
];

const BY_ID = new Map(CREATIVES.map((c) => [c.id, c]));

export function creativeById(id: string): Creative | undefined {
  return BY_ID.get(id);
}

/**
 * The engine's creative resolver.
 *
 * Falls back to strictly average attributes for an unknown id rather than
 * throwing: a mission or a saved account referencing a creative that has since
 * been renamed should degrade to "an ordinary ad", not take down the tick.
 */
export function resolveCreative(id: string): CreativeAttributes {
  const c = BY_ID.get(id);
  if (!c) return { baseCtrMultiplier: 1, fatigueRate: 0.28, coldAffinity: 1, hookStrength: 1 };
  return {
    baseCtrMultiplier: c.baseCtrMultiplier,
    fatigueRate: c.fatigueRate,
    coldAffinity: c.coldAffinity,
    hookStrength: c.hookStrength,
  };
}

// ────────────────────────────────────────────────────────────────── ad copy ──

/**
 * Structural scoring for learner-written ad copy.
 *
 * Being honest about the limits here: this does not judge whether the writing is
 * good, because nothing in this codebase can. It rewards a handful of structural
 * habits the curriculum actually teaches (lead with a hook, keep the primary text
 * scannable, make the offer concrete, match the CTA to the objective) and caps its
 * own influence well below the creative asset's. The asset choice is the modelled
 * lever; copy is a nudge.
 */
export interface CopyFields {
  primaryText: string;
  headline: string;
  cta: string;
}

export function scoreCopy(copy: CopyFields): number {
  let score = 0;

  const text = copy.primaryText.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  // Long enough to say something, short enough to survive the "See more" fold.
  if (words >= 8 && words <= 90) score += 1;
  // A hook in the opening line, rather than opening on the brand name.
  const firstLine = text.split(/[.!?\n]/)[0] ?? '';
  if (firstLine.length > 0 && firstLine.length <= 90) score += 1;
  // Something concrete: a number, a price, a percentage, a timeframe.
  if (/\d/.test(text)) score += 1;

  const headline = copy.headline.trim();
  if (headline.length >= 3 && headline.length <= 40) score += 1;

  if (copy.cta.trim().length > 0) score += 1;

  // 0-5 structural points mapped into a deliberately narrow multiplier band.
  return 0.94 + (score / 5) * 0.12;
}

export const CTA_OPTIONS = [
  'Shop now', 'Learn more', 'Sign up', 'Get offer', 'Subscribe', 'Book now', 'Download',
] as const;
