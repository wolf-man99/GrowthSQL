/**
 * The course catalog. Tiramisu is now a multi-course platform; "SQL for
 * Marketers" is the first live course. Adding a course later: Meta Ads content, then
 * Google Ads, then the rest: is a data change here plus its content, not a rebuild.
 *
 * `price`/`bundleEligible` here are display-only leftovers from before real payments
 * existed, Meta Ads' actual per-tier pricing (Learn/Run/Bundle) lives in
 * `src/lib/payments/pricing.ts` instead, since one course needs three prices, a
 * shape this single `price` field can't hold. Entitlements live on `Enrollment`
 * (`learnPurchasedAt`/`runPurchasedAt`), granted by a verified Razorpay payment.
 *
 * Each course's `accent` is one slot in Tiramisu's six-colour system (see the
 * comment atop globals.css): every course owns exactly one hue, and no two
 * courses share one: purple/SQL, blue/Meta, green/Google, teal/LinkedIn,
 * red/Reddit, amber/Snapchat. Blue and purple additionally carry a
 * non-course job (the flagship platform action colour, and AI-coach
 * features) but that only shows up outside the catalog.
 */

export type CourseStatus = 'live' | 'in-progress' | 'coming-soon';

export interface Course {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  status: CourseStatus;
  emoji: string;
  accent: string; // CSS color
  category: 'Analytics' | 'Paid media';
  /** Where "Start course" navigates for a live course. */
  href: string;
  level: string;
  duration: string;
  lessons: number;
  highlights: string[];
  /** Future monetisation, unused until payments ship. */
  price?: number;
  bundleEligible?: boolean;
}

export const COURSES: Course[] = [
  {
    id: 'sql-for-marketers',
    slug: 'sql-for-marketers',
    title: 'SQL for Marketers',
    tagline: 'Zero to marketing analyst in 14 days',
    description:
      'Learn BigQuery SQL on a real marketing warehouse: a real editor, an AI coach, and 300 graded exercises. Answer the questions a growth team actually argues about.',
    status: 'live',
    emoji: '🗃️',
    accent: '#6c3bff',
    category: 'Analytics',
    href: '/dashboard',
    level: 'Beginner → Advanced',
    duration: '14 days',
    lessons: 14,
    highlights: ['Real BigQuery, runs locally', '300 graded exercises', 'AI coach', '10 projects · 10 mock interviews'],
    price: 0,
    bundleEligible: true,
  },
  {
    id: 'meta-ads',
    slug: 'meta-ads',
    title: 'Meta Ads Mastery',
    tagline: 'Run Facebook & Instagram ads that actually convert',
    description:
      'From the pixel to CBO to creative testing. Build, launch, and scale Meta campaigns the way a performance marketer does. Interactive, gamified, and hands-on.',
    status: 'live',
    emoji: '📘',
    accent: '#045099',
    category: 'Paid media',
    href: '/courses/meta-ads',
    level: 'Beginner → Advanced',
    duration: '7 modules · 23 lessons',
    lessons: 23,
    highlights: ['Structure, the auction & the pixel', 'Audiences, creative & CBO', 'Testing, optimising & scaling', 'Interactive, gamified lessons'],
    price: 0,
    bundleEligible: true,
  },
  {
    id: 'google-ads',
    slug: 'google-ads',
    title: 'Google Ads',
    tagline: 'Search, Shopping, PMax, the intent engine',
    description: 'Capture demand where it lives. Search, Shopping and Performance Max, from keyword match types to bidding strategy.',
    status: 'live',
    emoji: '🔍',
    accent: '#1e8e4a',
    category: 'Paid media',
    href: '/courses/google-ads',
    level: 'Beginner → Intermediate',
    duration: '7 modules · 21 lessons',
    lessons: 21,
    highlights: ['Intent, structure & the auction', 'Match types & search terms', 'Quality Score & Smart Bidding', 'Shopping & Performance Max'],
    price: 0,
    bundleEligible: true,
  },
  {
    id: 'linkedin-ads',
    slug: 'linkedin-ads',
    title: 'LinkedIn Ads',
    tagline: 'B2B demand gen that respects the CAC',
    description: 'The most expensive clicks in advertising, spent well. Targeting, sponsored content, and lead gen for B2B.',
    status: 'coming-soon',
    emoji: '💼',
    accent: '#17a398',
    category: 'Paid media',
    href: '/courses/linkedin-ads',
    level: 'Intermediate',
    duration: 'Coming soon',
    lessons: 0,
    highlights: ['B2B targeting', 'Sponsored content', 'Lead-gen forms', 'CAC discipline'],
    bundleEligible: true,
  },
  {
    id: 'reddit-ads',
    slug: 'reddit-ads',
    title: 'Reddit Ads',
    tagline: 'Advertise where communities actually gather',
    description: 'Reach passionate niches without getting downvoted. Subreddit targeting, native creative, and community-safe messaging.',
    status: 'coming-soon',
    emoji: '👽',
    accent: '#e51f27',
    category: 'Paid media',
    href: '/courses/reddit-ads',
    level: 'Intermediate',
    duration: 'Coming soon',
    lessons: 0,
    highlights: ['Subreddit targeting', 'Native creative', 'Community fit'],
    bundleEligible: true,
  },
  {
    id: 'snapchat-ads',
    slug: 'snapchat-ads',
    title: 'Snapchat Ads',
    tagline: 'Full-screen, vertical, Gen-Z native',
    description: 'Reach a younger audience with thumb-stopping vertical creative, AR lenses, and Snap Pixel optimisation.',
    status: 'coming-soon',
    emoji: '👻',
    accent: '#f5a623',
    category: 'Paid media',
    href: '/courses/snapchat-ads',
    level: 'Beginner',
    duration: 'Coming soon',
    lessons: 0,
    highlights: ['Vertical creative', 'AR lenses', 'Snap Pixel'],
    bundleEligible: true,
  },
];

export function courseBySlug(slug: string): Course | undefined {
  return COURSES.find((c) => c.slug === slug);
}

export function liveCourses(): Course[] {
  return COURSES.filter((c) => c.status === 'live');
}

export const STATUS_LABEL: Record<CourseStatus, string> = {
  live: 'Live',
  'in-progress': 'In progress',
  'coming-soon': 'Coming soon',
};
