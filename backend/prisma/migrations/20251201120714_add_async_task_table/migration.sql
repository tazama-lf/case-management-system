-- CreateEnum
CREATE TYPE "public"."AsyncTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."work_queue_assignment_rules" ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- CreateTable
CREATE TABLE "public"."async_tasks" (
    "task_id" UUID NOT NULL,
    "task_type" VARCHAR(50) NOT NULL,
    "status" "public"."AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "max_retries" INTEGER NOT NULL DEFAULT 5,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "created_by" VARCHAR(100),

    CONSTRAINT "async_tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateIndex
CREATE INDEX "async_tasks_status_idx" ON "public"."async_tasks"("status");

-- CreateIndex
CREATE INDEX "async_tasks_task_type_idx" ON "public"."async_tasks"("task_type");

-- CreateIndex
CREATE INDEX "async_tasks_next_retry_at_idx" ON "public"."async_tasks"("next_retry_at");

-- CreateIndex
CREATE INDEX "async_tasks_created_at_idx" ON "public"."async_tasks"("created_at");

-- CreateIndex
CREATE INDEX "async_tasks_status_task_type_next_retry_at_idx" ON "public"."async_tasks"("status", "task_type", "next_retry_at");
