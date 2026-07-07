/*
  US-220-03: absolute SLA deadline stamping.

  Step 1: create the sla_policies lookup table (tenant-keyed, no FK since no Tenant
          table exists anywhere in this schema — same bare-tenant_id pattern used by
          every other tenant-scoped table here, e.g. cms_usernames).
  Step 2: seed system-wide fallback defaults under the tenant_id = 'DEFAULT' sentinel,
          mirroring the existing 'DEFAULT' sentinel convention from the event_log
          backfill migration. Tenants without their own override row fall back to these.
  Step 3: add the nullable sla_due_at column to cases. Application code stamps this at
          creation and re-anchors it (to created_at, never now()) whenever priority changes;
          it is never written by the cron job.
  Step 4: backfill existing OPEN cases with created_at + a conservative flat 72h default
          (not the per-priority policy — this is a one-time approximation for legacy rows).
          Closed and abandoned cases are left NULL; an SLA deadline is meaningless once a
          case is terminal.
*/

-- Step 1
CREATE TABLE "sla_policies" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "target_hours" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_tenant_id_priority_key" ON "sla_policies"("tenant_id", "priority");

-- Step 2
INSERT INTO "sla_policies" ("tenant_id", "priority", "target_hours", "updated_at") VALUES
    ('DEFAULT', 'HIGH', 24, CURRENT_TIMESTAMP),
    ('DEFAULT', 'MEDIUM', 72, CURRENT_TIMESTAMP),
    ('DEFAULT', 'LOW', 168, CURRENT_TIMESTAMP);

-- Step 3
ALTER TABLE "cases" ADD COLUMN "sla_due_at" TIMESTAMP(6);

-- Step 4
UPDATE "cases"
SET "sla_due_at" = "created_at" + INTERVAL '72 hours'
WHERE "sla_due_at" IS NULL
  AND "status" NOT IN (
    'STATUS_81_CLOSED_REFUTED',
    'STATUS_82_CLOSED_CONFIRMED',
    'STATUS_83_CLOSED_INCONCLUSIVE',
    'STATUS_71_AUTOCLOSED_CONFIRMED',
    'STATUS_72_AUTOCLOSED_REFUTED',
    'STATUS_99_ABANDONED'
  );
