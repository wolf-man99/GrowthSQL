import { PrismaClient } from '@prisma/client';
import { FLASHCARDS } from '../src/lib/content/flashcards';
import { hashPassword } from '../src/lib/auth/session';

/**
 * Seeds content-derived rows (flashcards), the simulated leaderboard rivals, and a
 * demo account so the platform is usable out of the box. Idempotent.
 */
const prisma = new PrismaClient();

/** 24 rivals on a spread of skill curves, so the leaderboard has texture and movement. */
const RIVAL_NAMES: [string, string][] = [
  ['Priya Sharma', 'IN'], ['Marcus Okafor', 'NG'], ['Ana Silva', 'BR'], ['Wei Chen', 'CN'],
  ['Sofia Rossi', 'IT'], ['Tomas Novak', 'CZ'], ['Aisha Ahmed', 'AE'], ['Liam Murphy', 'IE'],
  ['Yuki Tanaka', 'JP'], ['Elena Weber', 'DE'], ['Omar Haddad', 'LB'], ['Grace Bennett', 'GB'],
  ['Diego Alvarez', 'MX'], ['Fatima Nasser', 'EG'], ['Lucas Moreau', 'FR'], ['Mei Zhang', 'CN'],
  ['Ravi Patel', 'IN'], ['Clara Lindqvist', 'SE'], ['Jonas Berg', 'NO'], ['Zara Adeyemi', 'NG'],
  ['Andre Ferreira', 'PT'], ['Nina Kowalski', 'PL'], ['Kwame Mensah', 'GH'], ['Hana Kim', 'KR'],
];

const TITLES = ['Junior Analyst', 'Analyst', 'Growth Analyst', 'Senior Analyst', 'Metrics Fluent'];

/** Kept in step with scripts/make-demo-account.ts, which writes the same row from
 *  SQL for environments where seeding cannot open a Postgres connection. */
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@tiramisu.com';

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  // Flashcards (content, replace wholesale so edits propagate).
  for (const f of FLASHCARDS) {
    await prisma.flashcard.upsert({
      where: { id: f.id },
      update: { deck: f.deck, front: f.front, back: f.back, concept: f.concept },
      create: { id: f.id, deck: f.deck, front: f.front, back: f.back, concept: f.concept },
    });
  }

  // Rivals. Deterministic curves so the board is stable across reseeds.
  const rng = mulberry32(424242);
  for (let i = 0; i < RIVAL_NAMES.length; i++) {
    const [name, country] = RIVAL_NAMES[i];
    const skill = rng(); // 0..1
    const baseXp = Math.round(200 + skill * 9000 + rng() * 1500);
    const dailyXp = Math.round(40 + skill * 260);
    const level = Math.max(1, Math.round(2 + skill * 26));
    await prisma.rival.upsert({
      where: { id: `rival-${i + 1}` },
      update: { displayName: name, country, baseXp, dailyXp, streak: Math.round(rng() * 40), level, title: TITLES[Math.min(TITLES.length - 1, Math.floor(skill * TITLES.length))] },
      create: {
        id: `rival-${i + 1}`,
        displayName: name,
        avatarSeed: name.toLowerCase().replace(/\s+/g, '-'),
        country,
        baseXp,
        dailyXp,
        streak: Math.round(rng() * 40),
        level,
        title: TITLES[Math.min(TITLES.length - 1, Math.floor(skill * TITLES.length))],
      },
    });
  }

  // A ready-to-use demo account with a little progress, so the platform and the
  // leaderboard are alive on first run.
  // Drop any earlier demo row first: it holds the same referralCode, so a rename
  // of the demo email would otherwise collide on that unique column.
  await prisma.profile.deleteMany({
    where: { isDemo: true, email: { not: DEMO_EMAIL } },
  });
  await prisma.profile.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      // Read from the environment so production's demo password is not a literal
      // in a git repository. The fallback is for local development only, where the
      // database is a throwaway and the account guards nothing.
      passwordHash: hashPassword(process.env.DEMO_PASSWORD || 'demopass123'),
      provider: 'credentials',
      displayName: 'Demo Analyst',
      avatarSeed: 'demo',
      referralCode: 'demo1234',
      isDemo: true,
      xp: 640,
      level: 4,
      coins: 64,
      currentStreak: 3,
      longestStreak: 3,
    },
  });

  const cards = await prisma.flashcard.count();
  const rivals = await prisma.rival.count();
  console.log(`Seeded ${cards} flashcards, ${rivals} rivals, and the demo account (${DEMO_EMAIL}).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
