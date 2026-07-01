-- Backfill InvestigationGroup records from FRAUD_AND_AML container cases
-- Prerequisites: migration 20260701000001_add_investigation_group must have run.
-- Run this script inside a single transaction so it is fully atomic.
--
-- What this script does (in order):
--   Step 1 — Create one InvestigationGroup per FRAUD_AND_AML container case
--   Step 2 — Set cases.group_id on all sub-cases (FRAUD + AML children)
--   Step 3 — NULL out cases.parent_id on sub-cases (group_id replaces parent_id)
--   Step 4 — Close container Case rows (kept for audit history, not deleted)
--   Step 5 — NULL out alerts.case_id for FRAUD_AND_AML alerts
--             (the Alert → InvestigationGroup link is now via investigation_groups.alert_id)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Preflight A: every FRAUD_AND_AML container case must have a linked alert.
-- Without this, Steps 1 and 2 would silently skip some containers and the
-- sub-cases of those containers would be orphaned with no group_id.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    missing_alert_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO missing_alert_count
    FROM cases c
    LEFT JOIN alerts a ON a.case_id = c.case_id
    WHERE c.case_type = 'FRAUD_AND_AML'
      AND c.parent_id IS NULL
      AND a.alert_id IS NULL;

    IF missing_alert_count > 0 THEN
        RAISE EXCEPTION
            'Backfill aborted: % FRAUD_AND_AML container case(s) have no linked alert row',
            missing_alert_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 1: Create one InvestigationGroup per FRAUD_AND_AML container case.
-- ON CONFLICT makes the step idempotent — safe to re-run if the script is
-- interrupted and restarted.
-- ---------------------------------------------------------------------------
INSERT INTO investigation_groups (alert_id, tenant_id, created_at)
SELECT
    a.alert_id,
    c.tenant_id,
    NOW()
FROM cases c
JOIN alerts a ON a.case_id = c.case_id
WHERE c.case_type = 'FRAUD_AND_AML'
  AND c.parent_id IS NULL
ON CONFLICT (alert_id) DO NOTHING;

-- Post-Step-1 validation: every container must now have a matching InvestigationGroup
-- before we touch any case rows.
DO $$
DECLARE
    missing_group_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO missing_group_count
    FROM cases c
    JOIN alerts a ON a.case_id = c.case_id
    LEFT JOIN investigation_groups ig ON ig.alert_id = a.alert_id
    WHERE c.case_type = 'FRAUD_AND_AML'
      AND c.parent_id IS NULL
      AND ig.id IS NULL;

    IF missing_group_count > 0 THEN
        RAISE EXCEPTION
            'Backfill aborted: % FRAUD_AND_AML container case(s) did not receive an InvestigationGroup',
            missing_group_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 2: Assign group_id to all sub-cases of each FRAUD_AND_AML container.
-- After this step the FRAUD and AML child cases are linked to each other via
-- the InvestigationGroup, independently of parent_id.
-- ---------------------------------------------------------------------------
UPDATE cases sub
SET group_id = ig.id
FROM cases parent
JOIN alerts a    ON a.case_id   = parent.case_id
JOIN investigation_groups ig ON ig.alert_id = a.alert_id
WHERE parent.case_type = 'FRAUD_AND_AML'
  AND parent.parent_id IS NULL
  AND sub.parent_id    = parent.case_id;

-- Post-Step-2 validation: every sub-case of a container must have group_id set.
DO $$
DECLARE
    missing_sub_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO missing_sub_count
    FROM cases sub
    JOIN cases parent ON sub.parent_id = parent.case_id
    WHERE parent.case_type = 'FRAUD_AND_AML'
      AND parent.parent_id IS NULL
      AND sub.group_id IS NULL;

    IF missing_sub_count > 0 THEN
        RAISE EXCEPTION
            'Backfill aborted: % sub-case(s) were not assigned a group_id',
            missing_sub_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 3: NULL out parent_id on all sub-cases that now carry a group_id.
-- group_id replaces parent_id as the grouping mechanism. The parent_id column
-- itself is retained in the schema and dropped in a follow-on migration once
-- application code no longer references it.
-- ---------------------------------------------------------------------------
UPDATE cases
SET parent_id = NULL
WHERE group_id IS NOT NULL
  AND parent_id IS NOT NULL;

-- Post-Step-3 validation: no case that has a group_id should still have a parent_id.
DO $$
DECLARE
    stale_parent_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO stale_parent_count
    FROM cases
    WHERE group_id IS NOT NULL
      AND parent_id IS NOT NULL;

    IF stale_parent_count > 0 THEN
        RAISE EXCEPTION
            'Backfill aborted: % sub-case(s) still have parent_id set after group_id assignment',
            stale_parent_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 4: Close all FRAUD_AND_AML container cases.
-- Rows are NOT deleted — they are retained for audit history.
-- ---------------------------------------------------------------------------
UPDATE cases
SET status = 'STATUS_83_CLOSED_INCONCLUSIVE'
WHERE case_type = 'FRAUD_AND_AML'
  AND parent_id IS NULL;

-- ---------------------------------------------------------------------------
-- Step 5: NULL out alerts.case_id for every alert whose container case has
-- been retired. Going forward, FRAUD_AND_AML alerts are linked to their
-- InvestigationGroup via investigation_groups.alert_id, not via alerts.case_id.
-- Non-FRAUD_AND_AML alerts (single-type FRAUD or AML) are untouched.
-- ---------------------------------------------------------------------------
UPDATE alerts a
SET case_id = NULL
FROM cases c
WHERE a.case_id    = c.case_id
  AND c.case_type  = 'FRAUD_AND_AML'
  AND c.parent_id IS NULL;

-- Post-Step-5 validation: no alert should still point to a FRAUD_AND_AML container case.
DO $$
DECLARE
    stale_alert_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO stale_alert_count
    FROM alerts a
    JOIN cases c ON a.case_id = c.case_id
    WHERE c.case_type = 'FRAUD_AND_AML';

    IF stale_alert_count > 0 THEN
        RAISE EXCEPTION
            'Backfill aborted: % alert(s) still reference a FRAUD_AND_AML container case',
            stale_alert_count;
    END IF;
END $$;

-- =============================================================================
-- Post-commit validation queries — run after COMMIT to confirm backfill is clean.
--
-- Expected: 0
-- SELECT count(*) FROM cases
-- WHERE case_type = 'FRAUD_AND_AML'
--   AND parent_id IS NULL
--   AND status != 'STATUS_83_CLOSED_INCONCLUSIVE';
--
-- Expected: 0 (no sub-case still chained to a container via parent_id)
-- SELECT count(*) FROM cases sub
-- JOIN cases parent ON sub.parent_id = parent.case_id
-- WHERE parent.case_type = 'FRAUD_AND_AML';
--
-- Expected: 0 (no alert still points to a FRAUD_AND_AML case)
-- SELECT count(*) FROM alerts a
-- JOIN cases c ON a.case_id = c.case_id
-- WHERE c.case_type = 'FRAUD_AND_AML';
--
-- Expected: matches count of InvestigationGroup rows (each group has its sub-cases)
-- SELECT ig.id, count(sub.case_id) FROM investigation_groups ig
-- LEFT JOIN cases sub ON sub.group_id = ig.id
-- GROUP BY ig.id;
-- =============================================================================

COMMIT;

-- =============================================================================
-- Down-migration (manual — no automated rollback)
--
-- All steps require restoring from a pre-backfill database backup because
-- original status, parent_id, and alerts.case_id values were not captured here.
--
-- Logical order if attempting a manual rollback:
--   1. Restore alerts.case_id for FRAUD_AND_AML alerts from backup.
--   2. Restore cases.parent_id for sub-cases from backup.
--   3. Restore container case statuses from backup.
--   4. Clear group_id and remove InvestigationGroup rows:
--         UPDATE cases SET group_id = NULL
--         WHERE group_id IN (SELECT id FROM investigation_groups);
--         DELETE FROM investigation_groups;
--   5. Drop schema objects (via migration rollback):
--         UPDATE cases SET group_id = NULL WHERE group_id IS NOT NULL;
--         ALTER TABLE "cases" DROP COLUMN "group_id";
--         DROP INDEX "investigation_groups_alert_id_key";
--         DROP TABLE "investigation_groups";
-- =============================================================================
