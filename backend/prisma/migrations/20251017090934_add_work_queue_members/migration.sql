/*
  Warnings:

  - You are about to drop the column `status` on the `alerts` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."TaskType" AS ENUM ('INVESTIGATION', 'APPROVAL', 'REVIEW', 'EVIDENCE_COLLECTION', 'REPORT_GENERATION', 'CASE_CLOSURE', 'ESCALATION');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'INVESTIGATOR', 'SUPERVISOR', 'ANALYST');

-- CreateEnum
CREATE TYPE "public"."AssignmentRuleType" AS ENUM ('PRIORITY_BASED', 'CASE_TYPE_BASED', 'ROUND_ROBIN', 'LOAD_BALANCED', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."AssignmentType" AS ENUM ('MANUAL', 'AUTOMATIC', 'OVERRIDE');

-- AlterTable
ALTER TABLE "public"."alerts" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "public"."tasks" ADD COLUMN     "task_type" "public"."TaskType",
ADD COLUMN     "work_queue_id" UUID;

-- CreateTable
CREATE TABLE "public"."work_queues" (
    "work_queue_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "tenant_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "work_queues_pkey" PRIMARY KEY ("work_queue_id")
);

-- CreateTable
CREATE TABLE "public"."work_queue_roles" (
    "work_queue_role_id" UUID NOT NULL,
    "work_queue_id" UUID NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_queue_roles_pkey" PRIMARY KEY ("work_queue_role_id")
);

-- CreateTable
CREATE TABLE "public"."work_queue_task_types" (
    "work_queue_task_type_id" UUID NOT NULL,
    "work_queue_id" UUID NOT NULL,
    "task_type" "public"."TaskType" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_queue_task_types_pkey" PRIMARY KEY ("work_queue_task_type_id")
);

-- CreateTable
CREATE TABLE "public"."work_queue_assignment_rules" (
    "assignment_rule_id" UUID NOT NULL,
    "work_queue_id" UUID NOT NULL,
    "rule_type" "public"."AssignmentRuleType" NOT NULL,
    "rule_config" JSONB NOT NULL,
    "priority_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "work_queue_assignment_rules_pkey" PRIMARY KEY ("assignment_rule_id")
);

-- CreateTable
CREATE TABLE "public"."work_queue_members" (
    "work_queue_member_id" UUID NOT NULL,
    "work_queue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assignment_type" "public"."AssignmentType" NOT NULL DEFAULT 'MANUAL',
    "assigned_by_user_id" UUID,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "work_queue_members_pkey" PRIMARY KEY ("work_queue_member_id")
);

-- CreateIndex
CREATE INDEX "work_queues_tenant_id_idx" ON "public"."work_queues"("tenant_id");

-- CreateIndex
CREATE INDEX "work_queues_is_active_idx" ON "public"."work_queues"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "work_queues_tenant_id_name_key" ON "public"."work_queues"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "work_queue_roles_work_queue_id_idx" ON "public"."work_queue_roles"("work_queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_queue_roles_work_queue_id_role_key" ON "public"."work_queue_roles"("work_queue_id", "role");

-- CreateIndex
CREATE INDEX "work_queue_task_types_work_queue_id_idx" ON "public"."work_queue_task_types"("work_queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_queue_task_types_work_queue_id_task_type_key" ON "public"."work_queue_task_types"("work_queue_id", "task_type");

-- CreateIndex
CREATE INDEX "work_queue_assignment_rules_work_queue_id_idx" ON "public"."work_queue_assignment_rules"("work_queue_id");

-- CreateIndex
CREATE INDEX "work_queue_assignment_rules_is_active_idx" ON "public"."work_queue_assignment_rules"("is_active");

-- CreateIndex
CREATE INDEX "work_queue_members_work_queue_id_idx" ON "public"."work_queue_members"("work_queue_id");

-- CreateIndex
CREATE INDEX "work_queue_members_user_id_idx" ON "public"."work_queue_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_queue_members_work_queue_id_user_id_key" ON "public"."work_queue_members"("work_queue_id", "user_id");

-- CreateIndex
CREATE INDEX "tasks_work_queue_id_idx" ON "public"."tasks"("work_queue_id");

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_roles" ADD CONSTRAINT "work_queue_roles_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_task_types" ADD CONSTRAINT "work_queue_task_types_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_assignment_rules" ADD CONSTRAINT "work_queue_assignment_rules_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_members" ADD CONSTRAINT "work_queue_members_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;
