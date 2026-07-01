-- CreateTable: lightweight grouping record replacing the FRAUD_AND_AML container Case row.
-- alert_id is the natural key — one alert maps to exactly one InvestigationGroup.
CREATE TABLE "investigation_groups" (
    "id" SERIAL NOT NULL,
    "alert_id" INTEGER NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investigation_groups_id" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "investigation_groups_alert_id_key" ON "investigation_groups"("alert_id");

-- AddColumn: sub-cases (FRAUD + AML) carry group_id to remain associated with each other
-- after the container Case is retired. Optional — NULL for all non-FRAUD_AND_AML cases.
ALTER TABLE "cases" ADD COLUMN "group_id" INTEGER;

-- Note: cases.parent_id is intentionally retained in this migration.
-- It is NULLed on sub-cases by the backfill script (step 3) and then dropped
-- in a follow-on migration once all application code references are removed.

-- Note: alerts.case_id is NULLed for FRAUD_AND_AML alerts by the backfill script (step 5).
-- The Alert → InvestigationGroup link is now carried by investigation_groups.alert_id.
-- alerts.case_id remains valid and unchanged for non-FRAUD_AND_AML (single-type) alerts.

-- DownMigration (not automated — run manually if rollback is needed)
-- Execute in order inside a transaction:
-- 1. Restore alerts.case_id for FRAUD_AND_AML alerts from a pre-backfill database backup.
-- 2. Restore cases.parent_id for sub-cases from a pre-backfill database backup.
-- 3. Restore container case statuses from a pre-backfill database backup.
--    (Original status of each container case was not preserved in this migration.)
-- 4. Clear sub-case group references and drop the column:
--       UPDATE cases SET group_id = NULL WHERE group_id IS NOT NULL;
--       ALTER TABLE "cases" DROP COLUMN "group_id";
-- 5. Drop the investigation_groups table:
--       DROP INDEX "investigation_groups_alert_id_key";
--       DROP TABLE "investigation_groups";
