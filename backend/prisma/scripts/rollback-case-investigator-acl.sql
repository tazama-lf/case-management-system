-- Rollback for the case-level ACL feature (case_investigators /
-- case_investigators_blacklist), covering both:
--   Step 1 — undo backfill-case-investigators.sql (delete the rows it seeded)
--   Step 2 — undo migration 20260914000000_add_case_investigator_acl (drop
--            the tables/enum entirely)
-- Step 2 is commented out by default — see "Which step do I need?" below.
--
-- Prisma migrations are forward-only; this is the manual "down" migration
-- Prisma doesn't generate for you.
--
-- HOW TO RUN: psql against the target database with ON_ERROR_STOP so a
-- failed safety check actually halts the script instead of psql printing
-- the error and continuing to the next statement:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rollback-case-investigator-acl.sql
--
-- SAFETY MODEL: both steps below open with the same preflight check and
-- ABORT (RAISE EXCEPTION, which rolls back that step's transaction) if they
-- find ANY row that isn't attributable to the backfill script's sentinel
-- actor (00000000-0000-0000-0000-000000000000) — i.e. any real grant that
-- upgraded a row, any revoke, any blacklist/unblock activity at all. Once
-- real activity exists, this feature's data is not safely undoable by a
-- generic script: a revoked row carries a supervisor's real revoke_reason,
-- a blacklist row carries a real block_reason — deleting or dropping those
-- is a genuine, possibly-regulator-relevant data loss, not a no-op. If the
-- preflight aborts, restore from a backup taken before the activity you
-- want to undo, or hand-author a migration that preserves what must be
-- preserved instead of running this script.
--
-- WHICH STEP DO I NEED?
--   - "I ran the backfill against the wrong environment / want to re-run
--     it cleanly" → Step 1 only. Leaves the schema in place.
--   - "I'm reverting the whole ACL feature, tables and all" → Step 1 then
--     uncomment and run Step 2.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: undo the backfill.
-- ---------------------------------------------------------------------------
BEGIN;

DO $$
DECLARE
    real_activity_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO real_activity_count
    FROM (
        SELECT 1 FROM case_investigators
        WHERE granted_by <> '00000000-0000-0000-0000-000000000000'
           OR revoked_at IS NOT NULL
        UNION ALL
        SELECT 1 FROM case_investigators_blacklist
    ) AS real_rows;

    IF real_activity_count > 0 THEN
        RAISE EXCEPTION
            'Rollback aborted: % row(s) of real activity found (a grant that upgraded a row, a revoke, or any blacklist/unblock entry). This script only undoes the sentinel-seeded backfill, not real usage — restore from backup or handle manually.',
            real_activity_count;
    END IF;
END $$;

DELETE FROM case_investigators
WHERE granted_by = '00000000-0000-0000-0000-000000000000';

COMMIT;

-- ---------------------------------------------------------------------------
-- Step 2 (schema-dropping — deliberately commented out; uncomment the
-- whole block below to actually run it). Reverses migration
-- 20260914000000_add_case_investigator_acl in full: FKs, both tables, the
-- enum. Repeats the same preflight as Step 1 in case time has passed and
-- real activity has since accumulated — do not skip re-running Step 1's
-- check just because it passed earlier.
-- ---------------------------------------------------------------------------
-- BEGIN;
--
-- DO $$
-- DECLARE
--     real_activity_count INTEGER;
-- BEGIN
--     SELECT COUNT(*) INTO real_activity_count
--     FROM (
--         SELECT 1 FROM case_investigators
--         WHERE granted_by <> '00000000-0000-0000-0000-000000000000'
--            OR revoked_at IS NOT NULL
--         UNION ALL
--         SELECT 1 FROM case_investigators_blacklist
--     ) AS real_rows;
--
--     IF real_activity_count > 0 THEN
--         RAISE EXCEPTION
--             'Schema rollback aborted: % row(s) of real activity found — dropping these tables would destroy it. Restore from backup or handle manually.',
--             real_activity_count;
--     END IF;
-- END $$;
--
-- ALTER TABLE "case_investigators_blacklist" DROP CONSTRAINT "case_investigators_blacklist_case_id_fkey";
-- ALTER TABLE "case_investigators" DROP CONSTRAINT "case_investigators_case_id_fkey";
-- DROP TABLE "case_investigators_blacklist";
-- DROP TABLE "case_investigators";
-- DROP TYPE "CaseInvestigatorMembership";
--
-- COMMIT;
--
-- After running Step 2, also:
--   1. Remove the CaseInvestigator / CaseInvestigatorBlacklist models,
--      the CaseInvestigatorMembership enum, and the two reverse relations
--      on Case from prisma/schema.prisma.
--   2. Delete (or mark reverted) the migration folder
--      prisma/migrations/20260914000000_add_case_investigator_acl, and
--      remove its row from Prisma's _prisma_migrations tracking table if
--      this database's migration history should no longer show it applied:
--        DELETE FROM "_prisma_migrations" WHERE migration_name = '20260914000000_add_case_investigator_acl';
--   3. Run `npx prisma generate` to drop the models from the generated
--      client — any code still referencing prisma.caseInvestigator* will
--      now fail to compile, which is the point (nothing should still
--      reference it after a full revert).
-- =============================================================================

-- =============================================================================
-- To fully re-apply after a Step-1-only rollback (schema untouched):
--   psql "$DATABASE_URL" -f backfill-case-investigators.sql
-- To fully re-apply after a Step-1-and-Step-2 rollback:
--   npx prisma migrate deploy   -- re-runs 20260914000000_add_case_investigator_acl
--   psql "$DATABASE_URL" -f backfill-case-investigators.sql
-- =============================================================================
