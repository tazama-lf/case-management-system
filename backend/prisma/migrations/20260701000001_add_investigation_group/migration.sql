-- CreateTable
CREATE TABLE "investigation_groups" (
    "id" SERIAL NOT NULL,
    "alert_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investigation_groups_id" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "investigation_groups_alert_id_key" ON "investigation_groups"("alert_id");

-- DownMigration (not automated — run manually if rollback is needed)
-- DROP INDEX "investigation_groups_alert_id_key";
-- DROP TABLE "investigation_groups";
-- UPDATE cases SET status = <prior_status> WHERE case_type = 'FRAUD_AND_AML';
-- Note: status column is an enum; restore to the value that was set before backfill.
-- Because the original status of each container case was not preserved in this migration,
-- a full rollback of the status column requires restoring from a pre-migration database backup.
