/*
  Tenant-configurable AT_RISK/DUE_SOON classification ratios (see sla-state.util.ts).
  One row per tenant, not per (tenant, priority): the ratios compare how much of a
  case's created_at->sla_due_at window remains, so the same pair of ratios applies
  consistently regardless of the priority-specific window length. BREACHED needs
  no row here — it's derived purely from sla_due_at having passed.
*/

-- CreateTable
CREATE TABLE "sla_escalation_thresholds" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "due_soon_ratio" DOUBLE PRECISION NOT NULL,
    "at_risk_ratio" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sla_escalation_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sla_escalation_thresholds_tenant_id_key" ON "sla_escalation_thresholds"("tenant_id");

-- Seed system-wide fallback defaults. Tenants without an override row use this.
INSERT INTO "sla_escalation_thresholds" ("tenant_id", "due_soon_ratio", "at_risk_ratio", "updated_at")
VALUES ('DEFAULT', 0.2, 0.5, CURRENT_TIMESTAMP);
