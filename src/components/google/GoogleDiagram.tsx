import type { GDiagramVariant } from '@/lib/content/google-ads/types';

/**
 * Inline-SVG concept diagrams for the Google Ads course.
 *
 * Same visual language as the Meta course's diagrams — hand-drawn boxes, the
 * Tiramisu palette, hard ink borders, no external libraries — but its own set of
 * pictures. The two courses illustrate genuinely different objects: Meta's are
 * audiences and budgets, Google's are queries and rank, and sharing components
 * would have meant sharing metaphors that do not transfer.
 *
 * Every diagram is authored to be readable at a phone width, which is why they run
 * to roughly 320 units wide and use 8–11px type. Nothing here scales down further,
 * so anything that would need six boxes gets redrawn as four.
 */
export function GoogleDiagram({ variant }: { variant: GDiagramVariant }) {
  const D = DIAGRAMS[variant];
  if (!D) return null;
  return (
    <div className="overflow-hidden rounded-[14px] border-2 border-[var(--ink)] bg-white p-4 shadow-[3px_3px_0_var(--ink)]">
      <D />
    </div>
  );
}

const box = (x: number, y: number, w: number, h: number, label: string, color: string, sub?: string) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="8" fill={`${color}2e`} stroke="var(--ink)" strokeWidth="1.5" />
    <text x={x + w / 2} y={y + (sub ? h / 2 - 4 : h / 2 + 4)} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">{label}</text>
    {sub && <text x={x + w / 2} y={y + h / 2 + 11} textAnchor="middle" fontSize="8.5" fill="var(--text-subtle)">{sub}</text>}
  </g>
);

const arrow = (x1: number, y1: number, x2: number, y2: number, color = 'var(--ink)') => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.75" markerEnd="url(#g-arrow)" />
);

const caption = (y: number, text: string, accent = false) => (
  <text x="160" y={y} textAnchor="middle" fontSize="9.5" fill={accent ? 'var(--accent-text)' : 'var(--text-subtle)'}>{text}</text>
);

function Defs() {
  return (
    <defs>
      <marker id="g-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <path d="M0,0 L6,3.5 L0,7 Z" fill="var(--ink)" />
      </marker>
    </defs>
  );
}

/* Tiramisu palette: purple, blue, teal, amber, red, green. */
const A = '#6c3bff', B = '#045099', C = '#17a398', W = '#f5a623', P = '#e51f27', G = '#1e8e4a';

const DIAGRAMS: Record<GDiagramVariant, () => React.ReactElement> = {
  'intent-vs-interruption': () => (
    <svg viewBox="0 0 320 178" className="w-full"><Defs />
      <text x="80" y="16" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--text)">META</text>
      <text x="240" y="16" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--text)">GOOGLE</text>
      <line x1="160" y1="24" x2="160" y2="150" stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 3" opacity="0.35" />

      {box(18, 28, 124, 30, 'You pick who', A, 'audiences, interests')}
      {arrow(80, 58, 80, 76)}
      {box(18, 78, 124, 30, 'Ad interrupts', A, 'mid-scroll')}
      {arrow(80, 108, 80, 126)}
      {box(18, 128, 124, 26, 'Create demand', A)}

      {box(178, 28, 124, 30, 'They type a query', B, 'already looking')}
      {arrow(240, 58, 240, 76)}
      {box(178, 78, 124, 30, 'You bid on it', B, 'keywords')}
      {arrow(240, 108, 240, 126)}
      {box(178, 128, 124, 26, 'Capture demand', B)}

      {caption(170, 'Same money. Opposite motion.')}
    </svg>
  ),

  'account-structure': () => (
    <svg viewBox="0 0 320 200" className="w-full"><Defs />
      {box(105, 6, 110, 30, 'Campaign', A, 'BUDGET · bidding')}
      {arrow(160, 36, 85, 54)} {arrow(160, 36, 235, 54)}
      {box(20, 56, 130, 30, 'Ad group', B, 'THEME · relevance')}
      {box(170, 56, 130, 30, 'Ad group', B, 'THEME · relevance')}
      {arrow(60, 86, 48, 104)} {arrow(110, 86, 118, 104)}
      {arrow(210, 86, 198, 104)} {arrow(260, 86, 268, 104)}
      {box(14, 106, 72, 28, 'Keywords', C)}
      {box(92, 106, 62, 28, 'Ads', W)}
      {box(164, 106, 72, 28, 'Keywords', C)}
      {box(242, 106, 62, 28, 'Ads', W)}
      {caption(154, 'Budget can only be set at the campaign.')}
      {caption(168, 'Relevance can only be earned at the ad group.', true)}
      {caption(186, 'One ad must answer every keyword beside it.')}
    </svg>
  ),

  'ad-rank': () => (
    <svg viewBox="0 0 320 186" className="w-full"><Defs />
      <text x="160" y="15" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">Highest Ad Rank wins, not highest bid</text>
      {box(28, 30, 96, 32, 'Your bid', W, 'the ceiling')}
      <text x="136" y="50" textAnchor="middle" fontSize="15" fill="var(--text-subtle)">×</text>
      {box(148, 30, 144, 32, 'Quality Score', C, 'CTR · relevance · page')}
      {arrow(160, 62, 160, 80, A)}
      {box(95, 82, 130, 32, 'Ad Rank', A, 'position')}

      <rect x="28" y="124" width="264" height="26" rx="8" fill={`${G}1f`} stroke="var(--ink)" strokeWidth="1.5" />
      <text x="160" y="141" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text)">You pay: rank below you ÷ your Quality Score</text>

      {caption(166, 'Better quality lifts rank AND divides your cost.', true)}
      {caption(179, 'Which is why a lower bid regularly beats a higher one.')}
    </svg>
  ),

  'match-types': () => (
    <svg viewBox="0 0 320 190" className="w-full"><Defs />
      <ellipse cx="160" cy="86" rx="146" ry="62" fill={`${P}1a`} stroke="var(--ink)" strokeWidth="1.5" />
      <ellipse cx="160" cy="92" rx="102" ry="44" fill={`${W}26`} stroke="var(--ink)" strokeWidth="1.5" />
      <ellipse cx="160" cy="98" rx="58" ry="26" fill={`${C}33`} stroke="var(--ink)" strokeWidth="1.5" />

      <text x="160" y="38" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">broad · running shoes</text>
      <text x="160" y="63" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">&quot;running shoes&quot;</text>
      <text x="160" y="101" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">[running shoes]</text>

      <text x="160" y="126" textAnchor="middle" fontSize="8.5" fill="var(--text-subtle)">jogging trainers · best sneakers · athletic wear</text>
      {caption(166, 'Wider reach outward. Tighter control inward.')}
      {caption(180, 'Neither end is right by default.', true)}
    </svg>
  ),

  'search-terms': () => (
    <svg viewBox="0 0 320 190" className="w-full"><Defs />
      {box(95, 6, 130, 28, 'Your keyword', B, 'running shoes')}
      {arrow(160, 34, 62, 52)} {arrow(160, 34, 160, 52)} {arrow(160, 34, 258, 52)}

      {box(10, 54, 104, 30, 'buy running shoes', G, 'converts →  add it')}
      {box(122, 54, 76, 30, 'best running', W, 'watch')}
      {box(206, 54, 104, 30, 'shoe repair', P, 'waste →  negate')}

      <rect x="14" y="98" width="292" height="30" rx="8" fill="var(--surface-3)" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="160" y="117" textAnchor="middle" fontSize="9.5" fill="var(--text-subtle)">…and a share you will never be shown, withheld for privacy</text>

      {caption(148, 'The keyword report is what you asked for.')}
      {caption(162, 'The search terms report is what you bought.', true)}
      {caption(180, 'Only one of them is reality.')}
    </svg>
  ),

  'quality-score': () => (
    <svg viewBox="0 0 320 176" className="w-full"><Defs />
      {box(8, 26, 96, 42, 'Expected CTR', B, 'weighted most')}
      {box(112, 26, 96, 42, 'Ad relevance', C, 'does it answer?')}
      {box(216, 26, 96, 42, 'Landing page', W, 'did it deliver?')}
      {arrow(56, 68, 150, 88)} {arrow(160, 68, 160, 88)} {arrow(264, 68, 172, 88)}
      {box(105, 90, 110, 32, 'Quality Score', A, '1 to 10')}
      {caption(140, 'Each is reported Below / Average / Above average.')}
      {caption(154, 'Fix the one that says Below. Not the headline number.', true)}
      {caption(170, 'It divides your CPC, so it is worth real money.')}
    </svg>
  ),

  'rsa-anatomy': () => (
    <svg viewBox="0 0 320 190" className="w-full"><Defs />
      <rect x="14" y="10" width="292" height="96" rx="10" fill="#ffffff" stroke="var(--ink)" strokeWidth="1.5" />
      <text x="26" y="28" fontSize="8" fontWeight="700" fill="var(--text-subtle)">Sponsored</text>
      <text x="26" y="45" fontSize="11" fontWeight="700" fill={B}>Running Shoes Online | Free 30-Day Returns</text>
      <text x="26" y="59" fontSize="8.5" fill={G}>northbound.example › running-shoes</text>
      <text x="26" y="74" fontSize="8.5" fill="var(--text-muted)">Waterproof trail shoes built for Indian monsoons. Rated 4.8 by</text>
      <text x="26" y="85" fontSize="8.5" fill="var(--text-muted)">12,000 runners. Free shipping over ₹999.</text>
      <text x="26" y="99" fontSize="8.5" fill={B}>Shop Men · Shop Women · Size Guide · Returns</text>

      {box(10, 118, 92, 28, '15 headlines', W, '30 chars each')}
      {box(112, 118, 92, 28, '4 descriptions', C, '90 chars each')}
      {box(214, 118, 96, 28, 'Assets', A, 'sitelinks · callouts')}

      {caption(164, 'Google assembles a fresh combination per auction.')}
      {caption(178, 'So every headline must read well beside every other.', true)}
    </svg>
  ),

  'bidding-ladder': () => (
    <svg viewBox="0 0 320 196" className="w-full"><Defs />
      <text x="18" y="14" fontSize="8.5" fontWeight="700" fill="var(--text-subtle)">YOU CONTROL</text>
      <text x="302" y="14" textAnchor="end" fontSize="8.5" fontWeight="700" fill="var(--text-subtle)">GOOGLE CONTROLS</text>
      {box(14, 22, 150, 26, 'Manual CPC', P, 'no signals')}
      {box(44, 52, 180, 26, 'Maximise clicks', W, 'needs no conversions')}
      {box(74, 82, 200, 26, 'Maximise conversions', W, 'needs some')}
      {box(94, 112, 210, 26, 'Target CPA', C, 'needs steady volume')}
      {box(110, 142, 196, 26, 'Target ROAS', G, 'needs conversion values')}
      {caption(184, 'Each rung is hungrier than the last. Feed it or it starves.', true)}
    </svg>
  ),

  'shopping-flow': () => (
    <svg viewBox="0 0 320 176" className="w-full"><Defs />
      {box(12, 20, 90, 40, 'Your catalogue', C, 'titles · prices')}
      {arrow(102, 40, 122, 40)}
      {box(124, 20, 96, 40, 'Merchant Center', B, 'the feed')}
      {arrow(220, 40, 240, 40)}
      {box(242, 20, 66, 40, 'Google', A, 'matches')}
      {arrow(275, 60, 275, 78)}

      <rect x="188" y="80" width="120" height="58" rx="8" fill="#ffffff" stroke="var(--ink)" strokeWidth="1.5" />
      <rect x="196" y="88" width="40" height="34" rx="4" fill={`${W}40`} stroke="var(--ink)" strokeWidth="1" />
      <text x="244" y="98" fontSize="7.5" fill="var(--text)">Northbound Trail</text>
      <text x="244" y="108" fontSize="7.5" fill="var(--text)">Runner Waterproof</text>
      <text x="244" y="120" fontSize="9" fontWeight="700" fill={G}>₹4,299</text>

      <text x="14" y="96" fontSize="9.5" fontWeight="700" fill="var(--text)">No keywords.</text>
      <text x="14" y="111" fontSize="9" fill="var(--text-subtle)">Your product titles</text>
      <text x="14" y="123" fontSize="9" fill="var(--accent-text)">are the keywords.</text>
      {caption(160, 'Which makes feed work the real optimisation work.')}
    </svg>
  ),

  'pmax-structure': () => (
    <svg viewBox="0 0 320 196" className="w-full"><Defs />
      {box(90, 6, 140, 30, 'Performance Max', A, 'one budget, one goal')}
      {arrow(160, 36, 160, 52)}
      {box(20, 54, 130, 30, 'Asset group', B, 'text · image · video')}
      {box(170, 54, 130, 30, 'Listing group', C, 'which products')}

      <rect x="14" y="96" width="292" height="34" rx="8" fill={`${W}26`} stroke="var(--ink)" strokeWidth="1.5" />
      <text x="160" y="110" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--text)">Search · Shopping · Display · YouTube · Gmail · Maps</text>
      <text x="160" y="123" textAnchor="middle" fontSize="8.5" fill="var(--text-subtle)">Google chooses the split. You do not see it.</text>

      {caption(150, 'Audience signal = a hint, not a boundary.', true)}
      {caption(164, 'It will go outside it whenever it smells a conversion.')}
      {caption(184, 'Reach bought with visibility. Make the trade on purpose.')}
    </svg>
  ),

  'impression-share': () => (
    <svg viewBox="0 0 320 172" className="w-full"><Defs />
      <text x="160" y="16" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">Every eligible auction, split three ways</text>
      <rect x="16" y="30" width="132" height="34" rx="7" fill={`${G}3a`} stroke="var(--ink)" strokeWidth="1.5" />
      <text x="82" y="51" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">Shown 45%</text>
      <rect x="148" y="30" width="30" height="34" fill={`${W}3a`} stroke="var(--ink)" strokeWidth="1.5" />
      <text x="163" y="51" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--text)">5%</text>
      <rect x="178" y="30" width="126" height="34" rx="7" fill={`${P}33`} stroke="var(--ink)" strokeWidth="1.5" />
      <text x="241" y="51" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">Lost to rank 50%</text>

      <text x="163" y="80" textAnchor="middle" fontSize="8" fill="var(--text-subtle)">budget</text>

      {box(16, 92, 132, 34, 'Lost to budget', W, 'add money')}
      {box(178, 92, 126, 34, 'Lost to rank', P, 'fix quality or bid')}

      {caption(148, 'Which loss dominates decides the fix.')}
      {caption(162, 'Budget added to a rank problem changes nothing.', true)}
    </svg>
  ),

  'optimisation-loop': () => (
    <svg viewBox="0 0 320 186" className="w-full"><Defs />
      {box(96, 8, 128, 30, '1 · Mine', B, 'search terms by cost')}
      {arrow(224, 23, 250, 44)}
      {box(196, 46, 116, 30, '2 · Negate', P, 'block the waste')}
      {arrow(254, 76, 232, 108)}
      {box(102, 110, 118, 30, '3 · Promote', G, 'winners → exact')}
      {arrow(102, 125, 74, 104)}
      {box(8, 46, 116, 30, '4 · Refine', C, 'only with evidence')}
      {arrow(66, 46, 100, 26)}
      {caption(160, 'Steps 1 and 2 hold most of the money.')}
      {caption(174, 'They are also the dullest, which is why they get skipped.', true)}
    </svg>
  ),
};
