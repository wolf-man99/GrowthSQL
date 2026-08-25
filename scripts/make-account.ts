/**
 * Prints the SQL that creates (or resets) a demo or admin account.
 *
 * `npm run db:seed` can make the demo account, but seeding needs a Postgres
 * connection, and the environments that most need these accounts are exactly the
 * ones where only the Supabase SQL editor is reachable. So this emits a statement
 * to paste there instead, with the password hashed here rather than in the
 * database — scrypt is not something SQL can do, and sending a plaintext password
 * through a query editor to be hashed server-side would be worse anyway.
 *
 * The two roles differ in what grants their power, not in how they log in:
 *
 *   demo   Entitled to every course by virtue of `isDemo`, including courses that
 *          do not exist yet (see src/lib/payments/entitlements.ts). Nothing
 *          per-course to grant, now or later.
 *   admin  An ordinary profile. It becomes an admin only when its address is in
 *          the deployment's `ADMIN_EMAILS`, so creating the row is half the job
 *          and the environment variable is the other half.
 *
 * Usage:
 *   npx tsx scripts/make-account.ts demo
 *   npx tsx scripts/make-account.ts demo 'a password you picked'
 *   npx tsx scripts/make-account.ts admin admin@yourdomain.com
 *   npx tsx scripts/make-account.ts admin admin@yourdomain.com 'a password'
 */

import { randomBytes, scryptSync } from 'node:crypto';

/** Same scheme as src/lib/auth/session.ts. Duplicated rather than imported so this
 *  script stays runnable without the app's module graph or a database URL. */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** Readable but not guessable: no ambiguous glyphs, enough entropy to be shared in
 *  a chat window without being a liability. */
function generatePassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(20), (b) => alphabet[b % alphabet.length]).join('');
}

/** Postgres string literal. Only ever fed a hash, a generated password or an
 *  address the operator typed, but quoting properly costs one line. */
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

const role = process.argv[2];
if (role !== 'demo' && role !== 'admin') {
  console.error('Usage: npx tsx scripts/make-account.ts <demo|admin> [email] [password]');
  process.exit(1);
}

const isAdmin = role === 'admin';
const email = isAdmin
  ? process.argv[3]
  : process.env.DEMO_EMAIL || 'demo@tiramisu.com';

if (isAdmin && !email) {
  console.error('An admin needs an address: npx tsx scripts/make-account.ts admin you@example.com');
  process.exit(1);
}

const givenPassword = isAdmin ? process.argv[4] : process.argv[3];
const password = givenPassword || generatePassword();
const hash = hashPassword(password);

const id = isAdmin ? `admin-${email!.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 20)}` : 'demo-account';
const displayName = isAdmin ? 'Admin' : 'Demo Analyst';

const sql = isAdmin
  ? `
-- Admin account. An ordinary profile: it gains admin rights only once its address
-- is listed in the deployment's ADMIN_EMAILS. Idempotent; re-running resets the
-- password to the one printed alongside this.
insert into "Profile" (id, email, "passwordHash", provider, "displayName", "avatarSeed", "updatedAt")
values (${lit(id)}, ${lit(email!)}, ${lit(hash)}, 'credentials', ${lit(displayName)}, 'admin', now())
on conflict (email) do update set
  "passwordHash" = excluded."passwordHash",
  "updatedAt"    = now();
`.trim()
  : `
-- Demo account: entitled to every course, present and future, via isDemo.
-- Idempotent. Re-running resets the password to the one printed alongside this.
insert into "Profile" (
  id, email, "passwordHash", provider, "displayName", "avatarSeed",
  "referralCode", "isDemo", xp, level, coins, "updatedAt"
)
values (
  ${lit(id)}, ${lit(email!)}, ${lit(hash)}, 'credentials', ${lit(displayName)}, 'demo',
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
console.log(`  email     ${email}`);
console.log(`  password  ${password}`);
if (isAdmin) {
  console.log();
  console.log('  Then add the address to ADMIN_EMAILS in the deployment environment');
  console.log('  and redeploy. Until that is set, /admin returns 404 for everyone,');
  console.log(`  including this account.  ADMIN_EMAILS=${email}`);
} else if (!givenPassword) {
  console.log();
  console.log('  Generated just now and printed only here. Save it before closing,');
  console.log('  then set DEMO_PASSWORD to the same value in the deployment env so');
  console.log('  a later `npm run db:seed` does not reset it to something else.');
}
console.log('─'.repeat(72));
