-- AlterTable
ALTER TABLE "work_queue_assignment_rules" ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- CreateTable
CREATE TABLE "event_log" (
    "event_log_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "entity_name" VARCHAR(50) NOT NULL,
    "action_performed" VARCHAR(255) NOT NULL,
    "outcome" VARCHAR(255) NOT NULL,
    "performed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_log_pkey" PRIMARY KEY ("event_log_id")
);
