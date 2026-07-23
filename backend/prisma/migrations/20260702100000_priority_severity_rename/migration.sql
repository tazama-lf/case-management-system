/*
  Phase 1 of 2 for replacing the time-based Priority enum (NEW, URGENT, CRITICAL, BREACH)
  with severity-based values (LOW, MEDIUM, HIGH).

  PostgreSQL cannot rename two enum values onto the same target label in a single
  ALTER TYPE statement, so CRITICAL and BREACH cannot both become HIGH via RENAME VALUE.
  This phase renames the three 1:1 mappings and backfills BREACH rows onto HIGH via UPDATE.
  BREACH remains a valid (but unused) enum label until phase 2 removes it.

  Step 1: Rename NEW -> LOW, URGENT -> MEDIUM, CRITICAL -> HIGH.
  Step 2: Column defaults were stored as the literal 'NEW', which no longer exists as a
          label after the rename, so they must be reset explicitly.
  Step 3: Backfill existing BREACH rows to HIGH (cases.priority is NOT NULL; alerts.priority
          is nullable and backfilled the same way for consistency).
*/

-- Step 1
ALTER TYPE "Priority" RENAME VALUE 'NEW' TO 'LOW';
ALTER TYPE "Priority" RENAME VALUE 'URGENT' TO 'MEDIUM';
ALTER TYPE "Priority" RENAME VALUE 'CRITICAL' TO 'HIGH';

-- Step 2
ALTER TABLE "cases" ALTER COLUMN "priority" SET DEFAULT 'LOW';
ALTER TABLE "alerts" ALTER COLUMN "priority" SET DEFAULT 'LOW';

-- Step 3
UPDATE "cases" SET "priority" = 'HIGH' WHERE "priority" = 'BREACH';
UPDATE "alerts" SET "priority" = 'HIGH' WHERE "priority" = 'BREACH';
