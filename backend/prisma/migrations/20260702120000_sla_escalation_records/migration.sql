/*
  US-220-05: idempotent SLA escalation notifications.

  sla_state itself is never stored on cases (it's derived at read time from
  sla_due_at vs now — see sla-state.util.ts). What IS stored here is a ledger of
  which (case_id, sla_state) pairs have already fired a notification, so the cron
  can check-before-send and never re-notify for a state it already handled, even
  across container restarts.
*/

-- CreateEnum
CREATE TYPE "SlaState" AS ENUM ('ON_TRACK', 'AT_RISK', 'DUE_SOON', 'BREACHED');

-- CreateTable
CREATE TABLE "sla_escalation_records" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "sla_state" "SlaState" NOT NULL,
    "notified_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_escalation_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sla_escalation_records_case_id_sla_state_key" ON "sla_escalation_records"("case_id", "sla_state");

-- AddForeignKey
ALTER TABLE "sla_escalation_records" ADD CONSTRAINT "sla_escalation_records_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;
