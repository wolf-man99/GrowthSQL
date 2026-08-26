-- Google Ads simulator: one row per simulated day.
--
-- Deliberately not shaped like SimDay. Meta's day is stored relationally because
-- its reports slice across entities and date ranges, which is what SQL is for.
-- Google's day is a different animal — an account total, a row per campaign, a row
-- per keyword, every search term that appeared, Performance Max's category
-- insights and an App campaign's channel split — and every read of it is "this one
-- learner's account, over a range of at most ninety days". Splitting that into five
-- tables would buy joins nobody needs and five chances for the pieces to disagree
-- about what happened, so the day is stored as the engine produced it.
--
-- Idempotent throughout: safe to run twice, and safe to run against a database
-- where an earlier attempt got partway.

CREATE TABLE IF NOT EXISTS "GSimDay" (
  "id"        TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "day"       INTEGER NOT NULL,
  -- GDayResult from src/lib/gsim/engine/types.ts.
  "result"    JSONB NOT NULL,
  CONSTRAINT "GSimDay_pkey" PRIMARY KEY ("id")
);

-- One row per (account, day). The tick writes with skipDuplicates, so this
-- constraint is what makes a retried advance a no-op rather than a double-count.
CREATE UNIQUE INDEX IF NOT EXISTS "GSimDay_accountId_day_key"
  ON "GSimDay" ("accountId", "day");

CREATE INDEX IF NOT EXISTS "GSimDay_accountId_idx"
  ON "GSimDay" ("accountId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GSimDay_accountId_fkey'
  ) THEN
    ALTER TABLE "GSimDay"
      ADD CONSTRAINT "GSimDay_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "SimAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
