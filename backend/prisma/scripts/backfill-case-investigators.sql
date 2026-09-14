-- Backfill CaseInvestigator (whitelist) rows from existing task assignment,
-- so today's de facto access carries forward once the ACL becomes the
-- enforced read gate.
-- Prerequisites: migration 20260914000000_add_case_investigator_acl must
-- have run — creates case_investigators/case_investigators_blacklist and
-- the partial unique indexes this script's ON CONFLICT clauses target.
-- Run inside a single transaction so it is fully atomic. Idempotent — safe
-- to re-run (e.g. after more cases/tasks have been created since the last
-- run — it will only ever add rows, never touch a row it didn't create).
--
-- The ACL (and this backfill) has exactly one source of truth: current
-- task assignment. Case.case_owner_user_id is never read.
--
-- What this script does (in order):
--   Step 1 — Task pass: LEAD row per (case, user) holding a non-completed
--            task
--   Step 2 — Observer pass: OBSERVER row per (case, user) that held a
--            completed task, skipping anyone who already got a LEAD row
--            in Step 1 (DO NOTHING never downgrades an existing LEAD)
--
-- tenant_id is copied from tasks.tenant_id (every task already carries its
-- own tenant_id, same convention as every other case-scoped table) — not
-- looked up separately from cases, and not left for a join at query time.
--
-- Note on why "reassigned away before completion" isn't a gap here: an
-- earlier draft of this backfill worried that Task.assigned_user_id being a
-- single mutable column (no history) means someone reassigned off a task
-- before it completed leaves no trace for Steps 1/2 to find. Under the live
-- ACL's rule, that's actually correct, not a gap — a live reassignment with
-- no other claim on the case auto-*revokes* that person, so finding zero
-- rows for them here matches what the live system would have done anyway.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: task pass. One LEAD row per (case, user) currently holding a
-- non-completed task. Always forces LEAD on conflict — re-running this
-- script after Step 2 seeded an OBSERVER row for the same pair, or after
-- someone picked up a new active task, should re-promote them.
-- ---------------------------------------------------------------------------
INSERT INTO case_investigators (case_id, tenant_id, user_id, membership, granted_by, granted_at)
SELECT DISTINCT
    t.case_id,
    t.tenant_id,
    t.assigned_user_id,
    'LEAD'::"CaseInvestigatorMembership",
    '00000000-0000-0000-0000-000000000000'::uuid,
    NOW()
FROM tasks t
WHERE t.assigned_user_id IS NOT NULL
  AND t.status != 'STATUS_30_COMPLETED'
ON CONFLICT (case_id, user_id) WHERE revoked_at IS NULL
DO UPDATE SET membership = 'LEAD'::"CaseInvestigatorMembership";

-- ---------------------------------------------------------------------------
-- Step 2: observer pass. One OBSERVER row per (case, user) that held a
-- completed task. DO NOTHING preserves whatever Step 1 already set — never
-- downgrades an existing LEAD.
-- ---------------------------------------------------------------------------
INSERT INTO case_investigators (case_id, tenant_id, user_id, membership, granted_by, granted_at)
SELECT DISTINCT
    t.case_id,
    t.tenant_id,
    t.assigned_user_id,
    'OBSERVER'::"CaseInvestigatorMembership",
    '00000000-0000-0000-0000-000000000000'::uuid,
    NOW()
FROM tasks t
WHERE t.assigned_user_id IS NOT NULL
  AND t.status = 'STATUS_30_COMPLETED'
ON CONFLICT (case_id, user_id) WHERE revoked_at IS NULL DO NOTHING;

-- ---------------------------------------------------------------------------
-- Post-Step-2 validation (inside the transaction — a failure here rolls
-- back the whole backfill, matching backfill-investigation-groups.sql's
-- pattern): every case with a current task assignee must now have at least
-- one live case_investigators row.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO missing_count
    FROM cases c
    WHERE EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.case_id = c.case_id AND t.assigned_user_id IS NOT NULL
    )
    AND NOT EXISTS (
        SELECT 1 FROM case_investigators ci
        WHERE ci.case_id = c.case_id AND ci.revoked_at IS NULL
    );

    IF missing_count > 0 THEN
        RAISE EXCEPTION
            'Backfill aborted: % case(s) with a current task assignee still have no live case_investigators row',
            missing_count;
    END IF;
END $$;

COMMIT;

-- =============================================================================
-- Informational (run after COMMIT — not part of the backfill's correctness,
-- just useful context for supervisors): cases nobody has ever been assigned
-- a task on. Expected to be non-empty and is NOT an error — investigators
-- still see these via the existing "unowned / ready-for-assignment"
-- browsing list; they simply have no case_investigators row until someone
-- is assigned.
--
-- SELECT c.case_id, c.status, c.created_at
-- FROM cases c
-- WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.case_id = c.case_id AND t.assigned_user_id IS NOT NULL)
-- ORDER BY c.created_at;
-- =============================================================================

-- =============================================================================
-- Rollback: see rollback-case-investigator-acl.sql in this same directory.
-- Do not hand-roll a DELETE here — that script includes the safety check
-- that refuses to remove rows once real (non-backfill) activity exists.
-- =============================================================================
