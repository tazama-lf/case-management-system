/*
  Tenant-configurable priorityScore -> LOW/MEDIUM/HIGH cutoffs (see case-priority.util.ts).
  One row per tenant: there's a single pair of cutoffs, not one per priority.
*/

-- CreateTable
CREATE TABLE "case_priority_thresholds" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "high_threshold" DOUBLE PRECISION NOT NULL,
    "medium_threshold" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "case_priority_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_priority_thresholds_tenant_id_key" ON "case_priority_thresholds"("tenant_id");

-- Seed system-wide fallback defaults. Tenants without an override row use this.
INSERT INTO "case_priority_thresholds" ("tenant_id", "high_threshold", "medium_threshold", "updated_at")
VALUES ('DEFAULT', 0.7, 0.4, CURRENT_TIMESTAMP);
