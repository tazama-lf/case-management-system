-- Formalize Case.group_id -> InvestigationGroup and InvestigationGroup.alert_id -> Alert
-- as real foreign keys so Prisma can navigate them (e.g. case.investigationGroup.alert)
-- instead of resolving alerts through a separate in-memory join.
--
-- Verified against existing data before merging: zero rows in cases.group_id or
-- investigation_groups.alert_id fail to resolve to their target table, so both
-- constraints below add cleanly (the backfill script in scripts/backfill-investigation-groups.sql
-- is what guarantees this — see its Step 1/Step 2 validations).

-- AlterTable: align the PK constraint name with Prisma's naming convention.
ALTER TABLE "investigation_groups" RENAME CONSTRAINT "investigation_groups_id" TO "investigation_groups_pkey";

-- CreateIndex
CREATE INDEX "cases_group_id_idx" ON "cases"("group_id");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "investigation_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_groups" ADD CONSTRAINT "investigation_groups_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("alert_id") ON DELETE RESTRICT ON UPDATE CASCADE;
