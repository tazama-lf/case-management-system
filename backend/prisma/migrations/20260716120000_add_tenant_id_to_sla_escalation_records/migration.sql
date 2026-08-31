/*
  Warnings:

  - Added the required column `tenant_id` to the `sla_escalation_records` table without a default value. This is not possible if the table is not empty.

  tenant_id is backfilled from the owning case (cases.tenant_id) rather than a
  blanket 'DEFAULT', since case_id already unambiguously determines the tenant
  for every existing row.
*/
-- AlterTable
-- Step 1
ALTER TABLE "sla_escalation_records" ADD COLUMN "tenant_id" TEXT;

-- Step 2
UPDATE "sla_escalation_records" ser
SET "tenant_id" = c."tenant_id"
FROM "cases" c
WHERE c."case_id" = ser."case_id";

-- Step 3
ALTER TABLE "sla_escalation_records" ALTER COLUMN "tenant_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "sla_escalation_records_tenant_id_idx" ON "sla_escalation_records"("tenant_id");
