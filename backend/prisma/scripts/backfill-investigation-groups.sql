-- Backfill InvestigationGroup records from FRAUD_AND_AML container cases
-- Prerequisites: migration 20260701000001_add_investigation_group must have run.
-- Run this script inside a single transaction so it is fully atomic.
-- =============================================================================

BEGIN;

-- Preflight: every FRAUD_AND_AML container case must have an alert link.
-- Without this check, the status update below could close a container case
-- without creating the required InvestigationGroup row.
DO $$
DECLARE
    missing_alert_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO missing_alert_count
    FROM cases c
    LEFT JOIN alerts a ON a.case_id = c.case_id
    WHERE c.case_type = 'FRAUD_AND_AML'
      AND a.alert_id IS NULL;

    IF missing_alert_count > 0 THEN
        RAISE EXCEPTION
            'Backfill aborted: % FRAUD_AND_AML container case(s) have no matching alerts.case_id',
            missing_alert_count;
    END IF;
END $$;

-- Step 1: Create one InvestigationGroup per existing FRAUD_AND_AML container case.
-- as a SERIAL integer, so we cast here.  ON CONFLICT is a safety net for
-- re-runs — it skips rows whose alert_id is already present.
INSERT INTO investigation_groups (alert_id, tenant_id, created_at)
SELECT
    a.alert_id,
    c.tenant_id,
    NOW()
FROM cases c
JOIN alerts a ON a.case_id = c.case_id
WHERE c.case_type = 'FRAUD_AND_AML'
ON CONFLICT (alert_id) DO NOTHING;

-- Post-insert validation: every FRAUD_AND_AML container case must now have
-- a matching InvestigationGroup row before any container statuses are changed.
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
      AND ig.id IS NULL;

    IF missing_group_count > 0 THEN
        RAISE EXCEPTION
            'Backfill aborted: % FRAUD_AND_AML container case(s) did not receive an InvestigationGroup',
            missing_group_count;
    END IF;
END $$;

-- Step 2: Close all FRAUD_AND_AML container cases (kept for audit history).
UPDATE cases
SET status = 'STATUS_83_CLOSED_INCONCLUSIVE'
WHERE case_type = 'FRAUD_AND_AML';

-- =============================================================================
-- Validation query - expected result: 0
-- Run this after committing to confirm the backfill is complete.
-- =============================================================================
-- SELECT count(*)
-- FROM cases
-- WHERE case_type = 'FRAUD_AND_AML'
--   AND status != 'STATUS_83_CLOSED_INCONCLUSIVE';

COMMIT;

-- =============================================================================
-- Down-migration (manual — no automated rollback)
--
-- 1. Restore case statuses from a pre-backfill database backup (the original
--    status of each container case was not persisted by this script).
-- 2. Delete the injected InvestigationGroup rows:
--       DELETE FROM investigation_groups
--       WHERE alert_id IN (
--           SELECT a.alert_id::TEXT FROM alerts a
--           JOIN cases c ON c.case_id = a.case_id
--           WHERE c.case_type = 'FRAUD_AND_AML'
--       );
-- 3. Drop the table/index via migration rollback:
--       DROP INDEX "investigation_groups_alert_id_key";
--       DROP TABLE "investigation_groups";
-- =============================================================================
