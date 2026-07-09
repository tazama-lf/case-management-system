/*
  SLA clock anchor: cases stop accruing SLA time while sitting in DRAFT or
  PENDING_CASE_CREATION_APPROVAL. The clock starts only once a case reaches
  STATUS_02_READY_FOR_ASSIGNMENT (RFA), and restarts from scratch every time a
  case reaches RFA again (first-time triage completion, or a case being
  reopened after closure).

  sla_started_at is the persisted anchor for that clock; sla_due_at continues
  to be derived from it (sla_started_at + per-priority target duration).
  Application code stamps both together, unconditionally, on every write that
  sets status to STATUS_02_READY_FOR_ASSIGNMENT.

  No backfill: existing open cases keep whatever sla_due_at they already have
  and get sla_started_at only the next time they genuinely re-enter RFA.
*/

ALTER TABLE "cases" ADD COLUMN "sla_started_at" TIMESTAMP(6);
