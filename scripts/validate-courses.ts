/**
 * Structural gate for the paid-media courses.
 *
 * The SQL course is checked by executing every query it ships. An ads course has
 * no equivalent — judgement cannot be run — so the things that can silently break
 * are structural: a multiple-choice answer index pointing past the end of its own
 * options, a scenario where no option is marked correct, a lesson whose moduleSlug
 * does not match the module it is filed under, two cards sharing an id inside one
 * lesson so the player treats them as already answered.
 *
 * None of those throw. They just quietly produce a lesson that cannot be completed
 * or teaches the wrong answer, and a learner finds it before anyone else does.
 *
 * Run: npx tsx scripts/validate-courses.ts
 */

import { META_MODULES } from '../src/lib/content/meta-ads';
import { GOOGLE_MODULES } from '../src/lib/content/google-ads';
import { isInteractive, type CourseModule } from '../src/lib/content/lesson-cards';
import { FREE_MODULE_COUNT } from '../src/lib/payments/pricing';

const failures: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail: string) {
  (condition ? notes : failures).push(`  ${condition ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
}

type AnyModule = CourseModule<string, string>;

function validateCourse(courseName: string, modules: AnyModule[]) {
  notes.push(`\n${courseName}`);

  const lessons = modules.flatMap((m) => m.lessons);
  const cards = lessons.flatMap((l) => l.cards);

  check('modules are numbered 1..n with no gaps',
    modules.every((m, i) => m.index === i + 1),
    `${modules.length} modules: ${modules.map((m) => m.index).join(', ')}`);

  check('module slugs are unique',
    new Set(modules.map((m) => m.slug)).size === modules.length,
    `${new Set(modules.map((m) => m.slug)).size} distinct of ${modules.length}`);

  // Lesson slugs are the URL, so a duplicate makes one lesson unreachable.
  const slugs = lessons.map((l) => l.slug);
  const dupSlugs = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  check('lesson slugs are unique across the course', dupSlugs.length === 0,
    dupSlugs.length === 0 ? `${slugs.length} lessons` : `duplicated: ${[...new Set(dupSlugs)].join(', ')}`);

  // A mismatched moduleSlug breaks the paywall's resolver, which validates that a
  // lesson really belongs to the module its itemId names.
  const misfiled = modules.flatMap((m) => m.lessons.filter((l) => l.moduleSlug !== m.slug).map((l) => l.slug));
  check('every lesson\'s moduleSlug matches the module it sits in', misfiled.length === 0,
    misfiled.length === 0 ? 'all filed correctly' : `misfiled: ${misfiled.join(', ')}`);

  check('every lesson has an objective, minutes and XP',
    lessons.every((l) => l.objective.length > 20 && l.minutes > 0 && l.xp > 0),
    `${lessons.length} lessons, ${lessons.reduce((a, l) => a + l.xp, 0)} XP total`);

  // Card ids are keyed per lesson by the player's `answered` map, so a repeat
  // inside one lesson marks the second card answered before it is shown.
  const dupCardIds = lessons.flatMap((l) => {
    const ids = l.cards.map((c) => c.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `${l.slug}#${id}`);
  });
  check('card ids are unique within each lesson', dupCardIds.length === 0,
    dupCardIds.length === 0 ? `${cards.length} cards` : `duplicated: ${dupCardIds.join(', ')}`);

  // Every lesson must be completable: the player requires an answer on interactive
  // cards, and a lesson of pure prose earns XP for scrolling.
  const noChecks = lessons.filter((l) => !l.cards.some(isInteractive)).map((l) => l.slug);
  check('every lesson contains at least one check', noChecks.length === 0,
    noChecks.length === 0
      ? `${cards.filter(isInteractive).length} interactive cards`
      : `no checks in: ${noChecks.join(', ')}`);

  // ── Per-card-kind correctness ────────────────────────────────────────────
  const bad: string[] = [];
  for (const lesson of lessons) {
    for (const card of lesson.cards) {
      const where = `${lesson.slug}#${card.id}`;
      switch (card.kind) {
        case 'mcq':
          if (card.options.length < 2) bad.push(`${where}: fewer than 2 options`);
          if (card.answer < 0 || card.answer >= card.options.length) bad.push(`${where}: answer index ${card.answer} out of range`);
          if (!card.explain.trim()) bad.push(`${where}: no explanation`);
          break;
        case 'multi':
          if (card.answers.length === 0) bad.push(`${where}: no correct answers`);
          if (card.answers.some((a) => a < 0 || a >= card.options.length)) bad.push(`${where}: answer index out of range`);
          break;
        case 'truefalse':
          if (!card.explain.trim()) bad.push(`${where}: no explanation`);
          break;
        case 'scenario':
          if (!card.options.some((o) => o.correct)) bad.push(`${where}: no option marked correct`);
          if (card.options.filter((o) => o.correct).length > 1) bad.push(`${where}: more than one correct option`);
          if (card.options.some((o) => !o.feedback.trim())) bad.push(`${where}: an option has no feedback`);
          break;
        case 'sort':
          if (card.items.length < 3) bad.push(`${where}: fewer than 3 items to order`);
          if (new Set(card.items).size !== card.items.length) bad.push(`${where}: duplicate items, so the order is ambiguous`);
          break;
        case 'teach':
          if (card.blocks.length === 0) bad.push(`${where}: no content`);
          break;
        default:
          break;
      }
    }
  }
  check('every interactive card is answerable and gradeable', bad.length === 0,
    bad.length === 0 ? 'mcq, multi, truefalse, scenario and sort all check out' : bad.join(' | '));

  // The free preview has to be worth previewing.
  const freeLessons = modules.filter((m) => m.index <= FREE_MODULE_COUNT).flatMap((m) => m.lessons);
  check(`the free preview (modules 1-${FREE_MODULE_COUNT}) is substantial`,
    freeLessons.length >= 4,
    `${freeLessons.length} lessons free before the paywall`);
}

validateCourse('Meta Ads Mastery', META_MODULES as AnyModule[]);
validateCourse('Google Ads', GOOGLE_MODULES as AnyModule[]);

// ── Cross-course ───────────────────────────────────────────────────────────

notes.push('\nAcross both courses');
{
  // Shared slugs across courses are legal, and here they are correct: both courses
  // genuinely have a lesson on account structure and one on the auction, and those
  // are the right names for them. Routes are course-scoped (/courses/{course}/
  // {lesson}), lookups go through each course's own index, and attempts carry a
  // courseId, so `foundations/account-structure` in one course can never resolve
  // to the other.
  //
  // Reported rather than failed, because the failure mode it hints at is real but
  // is not this: it would be a lookup that takes an itemId without a courseId. That
  // cannot be caught from the content, so it is called out here as the thing to
  // keep true rather than asserted as if it had been.
  const metaSlugs = new Set(META_MODULES.flatMap((m) => m.lessons.map((l) => l.slug)));
  const shared = GOOGLE_MODULES.flatMap((m) => m.lessons.map((l) => l.slug)).filter((s) => metaSlugs.has(s));
  notes.push(shared.length === 0
    ? '  note no lesson slug is shared between courses'
    : `  note ${shared.length} slug(s) shared between courses (${shared.join(', ')}) — legal, because every lookup is course-scoped`);

  // The invariant that actually matters: within a course, the itemId recorded on
  // an attempt must identify exactly one lesson.
  for (const [name, modules] of [['Meta Ads', META_MODULES], ['Google Ads', GOOGLE_MODULES]] as const) {
    const itemIds = (modules as AnyModule[]).flatMap((m) => m.lessons.map((l) => `${l.moduleSlug}/${l.slug}`));
    check(`${name} itemIds are unique within the course`,
      new Set(itemIds).size === itemIds.length,
      `${itemIds.length} lessons, ${new Set(itemIds).size} distinct itemIds`);
  }
}

console.log(notes.join('\n'));
if (failures.length > 0) {
  console.error(`\n${failures.length} course content failure(s):\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`\nCourse content valid: ${notes.filter((n) => n.startsWith('  ok')).length} checks.`);
