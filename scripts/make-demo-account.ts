/**
 * Prints the SQL that creates (or resets) the demo account.
 *
 * `npm run db:seed` already creates it, but seeding needs a Postgres connection,
 * and the environments that most need a demo account are exactly the ones where
 * only the Supabase SQL editor is reachable. So this emits a statement to paste
 * there instead, with the password hashed here rather than in the database —
 * scrypt is not something SQL can do, and sending a plaintext password through a
 * query editor to be hashed server-side would be worse anyway.
 *
 * The account is entitled to every course by virtue of `isDemo`, including
 * courses that do not exist yet: see src/lib/payments/entitlements.ts. There is
 * nothing per-course to grant here, now or later.
 *
 * Usage:
 *   npx tsx scripts/make-demo-account.ts                 # generates a password
 *   npx tsx scripts/make-demo-account.ts 'your password' # uses the one you pick
 */

import { randomBytes, scryptSync } from 'node:crypto';

const EMAIL = process.env.DEMO_EMAIL || 'demo@tiramisu.academy';

/** Same scheme as src/lib/auth/session.ts. Duplicated rather than imported so this
 *  script stays runnable without the app's module graph or a database URL. */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** Readable but not guessable: no ambiguous glyphs, enough entropy to be shared
 *  in a chat window without being a liability. */
function generatePassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(20);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const password = process.argv[2] || generatePassword();
const hash = hashPassword(password);
const generated = !process.argv[2];

const sql = `
-- Demo account: entitled to every course, present and future, via isDemo.
-- Idempotent. Re-running resets the password to the one printed alongside this.
insert into "Profile" (
  id, email, "passwordHash", provider, "displayName", "avatarSeed",
  "referralCode", "isDemo", xp, level, coins, "updatedAt"
)
values (
  'demo-account', '${EMAIL}', '${hash}', 'credentials', 'Demo Analyst', 'demo',
  'demo1234', true, 640, 4, 64, now()
)
on conflict (email) do update set
  "passwordHash" = excluded."passwordHash",
  "isDemo"       = true,
  "updatedAt"    = now();
`.trim();

console.log(sql);
console.log();
console.log('─'.repeat(72));
console.log(`  email     ${EMAIL}`);
console.log(`  password  ${password}`);
if (generated) {
  console.log();
  console.log('  Generated just now and printed only here. Save it before closing,');
  console.log('  then set DEMO_PASSWORD to the same value in the deployment env so');
  console.log('  a later `npm run db:seed` does not reset it to something else.');
}
console.log('─'.repeat(72));
