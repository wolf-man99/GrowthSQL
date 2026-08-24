'use client';

import type { Creative, CreativeLayout } from '@/lib/simulator/creatives';

/**
 * A mock ad frame, drawn rather than photographed.
 *
 * The account belongs to a fictional brand, so its creative has to be fictional
 * too. Generating each frame from a palette and a layout keeps that honest, ships
 * nothing binary, scales to any size, and cannot be mistaken for a real brand's
 * advertising the way a stock photo could.
 *
 * The layouts are caricatures of the formats the curriculum teaches: a UGC portrait
 * reads as phone-shot vertical video, an offer slab is mostly type, a catalog tile
 * grid is mostly product. A learner should recognise the *kind* of ad at thumbnail
 * size without needing to read the label, because that is the judgement module 3
 * is training.
 */

export function CreativeFrame({
  creative, size = 96, rounded = 10,
}: {
  creative: Creative;
  size?: number;
  rounded?: number;
}) {
  const [bg, fg] = creative.visual.palette;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${creative.name}: ${creative.concept}`}
      style={{ borderRadius: rounded, display: 'block', flexShrink: 0 }}
    >
      <rect width="100" height="100" fill={bg} />
      <Layout layout={creative.visual.layout} fg={fg} bg={bg} />
      <Caption
        kicker={creative.visual.kicker}
        overlay={creative.visual.overlay}
        layout={creative.visual.layout}
        fg={fg}
        bg={bg}
      />
    </svg>
  );
}

function Layout({ layout, fg, bg }: { layout: CreativeLayout; fg: string; bg: string }) {
  switch (layout) {
    // A person, shot vertically, filling the frame. The silhouette is what makes
    // this read as UGC rather than as a product shot.
    case 'ugc-portrait':
      return (
        <g fill={fg} opacity={0.9}>
          <circle cx="50" cy="34" r="14" />
          <path d="M22 100c0-17 12.5-28 28-28s28 11 28 28z" />
          <rect x="6" y="6" width="18" height="3" rx="1.5" opacity={0.5} />
        </g>
      );

    // Single product, centred, plenty of air. Deliberately calm.
    case 'product-hero':
      return (
        <g>
          <rect x="26" y="22" width="48" height="44" rx="6" fill={fg} opacity={0.92} />
          <rect x="34" y="32" width="32" height="4" rx="2" fill={bg} opacity={0.45} />
          <rect x="34" y="41" width="22" height="4" rx="2" fill={bg} opacity={0.3} />
        </g>
      );

    // Six shots, no hierarchy. Beautiful and hard to act on, which is the point.
    case 'lookbook-grid':
      return (
        <g fill={fg} opacity={0.88}>
          {[0, 1, 2].map((c) => [0, 1].map((r) => (
            <rect key={`${c}-${r}`} x={8 + c * 29} y={10 + r * 32} width="25" height="28" rx="3" opacity={0.6 + ((c + r) % 3) * 0.15} />
          )))}
        </g>
      );

    // Type doing the work. Big, loud, and it will wear out fast.
    case 'offer-slab':
      return (
        <g>
          <rect x="0" y="30" width="100" height="40" fill={fg} opacity={0.95} />
          <rect x="10" y="76" width="34" height="8" rx="4" fill={fg} opacity={0.55} />
        </g>
      );

    // A face and a quote mark: someone talking, not something selling.
    case 'testimonial-card':
      return (
        <g>
          <circle cx="28" cy="30" r="12" fill={fg} opacity={0.9} />
          <path d="M12 100c0-14 7-22 16-22s16 8 16 22z" fill={fg} opacity={0.9} />
          <text x="56" y="42" fontSize="34" fontFamily="Georgia, serif" fill={fg} opacity={0.55}>&#8220;</text>
          <rect x="54" y="50" width="36" height="3.5" rx="1.75" fill={fg} opacity={0.4} />
          <rect x="54" y="58" width="28" height="3.5" rx="1.75" fill={fg} opacity={0.3} />
        </g>
      );

    // A wall of product. What a catalog or carousel ad actually looks like.
    case 'catalog-tiles':
      return (
        <g fill={fg} opacity={0.9}>
          <rect x="6" y="8" width="40" height="40" rx="4" />
          <rect x="52" y="8" width="42" height="19" rx="4" opacity={0.75} />
          <rect x="52" y="31" width="42" height="17" rx="4" opacity={0.6} />
          <rect x="6" y="54" width="26" height="18" rx="4" opacity={0.7} />
          <rect x="38" y="54" width="26" height="18" rx="4" opacity={0.55} />
          <rect x="70" y="54" width="24" height="18" rx="4" opacity={0.45} />
        </g>
      );
  }
}

/**
 * The words burned into the frame.
 *
 * The offer slab puts them in the middle because the offer *is* the creative;
 * everything else keeps them out of the way at the bottom, where a real ad's
 * caption sits.
 */
function Caption({
  kicker, overlay, layout, fg, bg,
}: {
  kicker?: string;
  overlay: string;
  layout: CreativeLayout;
  fg: string;
  bg: string;
}) {
  if (layout === 'offer-slab') {
    return (
      <g textAnchor="middle">
        {kicker && (
          <text x="50" y="26" fontSize="7" fontWeight="600" fill={fg} opacity={0.85}
            fontFamily="system-ui, sans-serif" letterSpacing="0.5">
            {kicker}
          </text>
        )}
        <text x="50" y="56" fontSize="17" fontWeight="800" fill={bg}
          fontFamily="system-ui, sans-serif" letterSpacing="-0.4">
          {overlay}
        </text>
      </g>
    );
  }

  return (
    <g>
      {/* A scrim so the caption survives whatever it lands on. */}
      <rect x="0" y="76" width="100" height="24" fill={bg} opacity={0.82} />
      {kicker && (
        <text x="7" y="85" fontSize="5.5" fontWeight="700" fill={fg} opacity={0.8}
          fontFamily="system-ui, sans-serif" letterSpacing="0.6">
          {kicker.toUpperCase()}
        </text>
      )}
      <text x="7" y={kicker ? 95 : 91} fontSize="9" fontWeight="700" fill={fg}
        fontFamily="system-ui, sans-serif" letterSpacing="-0.2">
        {overlay}
      </text>
    </g>
  );
}
