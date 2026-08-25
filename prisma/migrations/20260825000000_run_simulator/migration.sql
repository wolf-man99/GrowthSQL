-- The Run simulator's four tables.
--
-- Adds the storage behind the Meta Ads account simulator: one account per learner
-- per mission (plus a sandbox), one row per entity per simulated day, the same day
-- broken out by age/gender/placement, and the record of each graded mission run.
--
-- Nothing existing is touched: four new tables, their indexes, and their foreign
-- keys back to Profile. No column on any current table changes, so this is safe to
-- run against a live database with learners on it.
--
-- Written to be idempotent. Running it twice, or re-running it after a partial
-- failure, is a no-op for whatever already exists.
--
-- This project deploys schema with `prisma db push` rather than `prisma migrate
-- deploy`, so the canonical way to apply this is:
--
--     npm run db:push          # from a machine that can reach the database
--
-- If that host cannot open a Postgres connection to Supabase, paste this file into
-- the Supabase SQL Editor instead. Both routes leave the database in the same
-- state; `db push` will report "already in sync" afterwards either way.

-- CreateTable
CREATE TABLE IF NOT EXISTS "SimAccount" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "missionId" TEXT,
    "currentDay" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "seed" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SimDay" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLevel" TEXT NOT NULL,
    "spend" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SimDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SimDaySegment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "entityId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "spend" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SimDaySegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MissionRun" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "accountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "score" INTEGER,
    "objectives" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "MissionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SimAccount_profileId_courseId_idx" ON "SimAccount"("profileId", "courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SimDay_accountId_day_idx" ON "SimDay"("accountId", "day");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SimDay_accountId_entityId_idx" ON "SimDay"("accountId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SimDay_accountId_day_entityId_key" ON "SimDay"("accountId", "day", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SimDaySegment_accountId_day_idx" ON "SimDaySegment"("accountId", "day");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SimDaySegment_accountId_day_entityId_dimension_segment_key" ON "SimDaySegment"("accountId", "day", "entityId", "dimension", "segment");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MissionRun_profileId_idx" ON "MissionRun"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MissionRun_profileId_missionId_key" ON "MissionRun"("profileId", "missionId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SimAccount_profileId_fkey') THEN
    ALTER TABLE "SimAccount" ADD CONSTRAINT "SimAccount_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SimDay_accountId_fkey') THEN
    ALTER TABLE "SimDay" ADD CONSTRAINT "SimDay_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SimAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SimDaySegment_accountId_fkey') THEN
    ALTER TABLE "SimDaySegment" ADD CONSTRAINT "SimDaySegment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SimAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MissionRun_profileId_fkey') THEN
    ALTER TABLE "MissionRun" ADD CONSTRAINT "MissionRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
