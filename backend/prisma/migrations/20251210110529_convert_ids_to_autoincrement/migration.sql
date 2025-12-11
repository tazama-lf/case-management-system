/*
  Warnings:

  - The primary key for the `alerts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `alert_id` column on the `alerts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `case_id` column on the `alerts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `async_tasks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `task_id` column on the `async_tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `audit_log` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `audit_log_id` column on the `audit_log` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `cases` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `case_id` column on the `cases` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `parent_id` column on the `cases` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `comments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `comment_id` column on the `comments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `case_id` column on the `comments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `task_id` column on the `comments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `configuration_change_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `configuration_change_logs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `evidence` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `evidence_id` column on the `evidence` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `integration_configs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `integration_configs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `notification_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `notification_log_id` column on the `notification_logs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `task_id` column on the `notification_logs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `case_id` column on the `notification_logs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `reports` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `report_id` column on the `reports` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `role_permissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `role_permissions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `system_configurations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `system_configurations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `tasks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `task_id` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `work_queue_id` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `user_notification_preferences` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `preference_id` column on the `user_notification_preferences` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `work_queue_assignment_rules` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `assignment_rule_id` column on the `work_queue_assignment_rules` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `work_queue_roles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `work_queue_role_id` column on the `work_queue_roles` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `work_queue_task_types` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `work_queue_task_type_id` column on the `work_queue_task_types` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `work_queues` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `work_queue_id` column on the `work_queues` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `config_id` on the `configuration_change_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `task_id` on the `evidence` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `task_id` on the `reports` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `case_id` on the `tasks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `work_queue_id` on the `work_queue_assignment_rules` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `work_queue_id` on the `work_queue_members` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `work_queue_id` on the `work_queue_roles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `work_queue_id` on the `work_queue_task_types` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."alerts" DROP CONSTRAINT "alerts_case_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."comments" DROP CONSTRAINT "comments_case_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."comments" DROP CONSTRAINT "comments_task_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."evidence" DROP CONSTRAINT "evidence_task_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."reports" DROP CONSTRAINT "reports_task_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."tasks" DROP CONSTRAINT "tasks_case_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."tasks" DROP CONSTRAINT "tasks_work_queue_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."work_queue_assignment_rules" DROP CONSTRAINT "work_queue_assignment_rules_work_queue_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."work_queue_members" DROP CONSTRAINT "work_queue_members_work_queue_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."work_queue_roles" DROP CONSTRAINT "work_queue_roles_work_queue_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."work_queue_task_types" DROP CONSTRAINT "work_queue_task_types_work_queue_id_fkey";

-- AlterTable
ALTER TABLE "public"."alerts" DROP CONSTRAINT "alerts_pkey",
DROP COLUMN "alert_id",
ADD COLUMN     "alert_id" SERIAL NOT NULL,
DROP COLUMN "case_id",
ADD COLUMN     "case_id" INTEGER,
ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("alert_id");

-- AlterTable
ALTER TABLE "public"."async_tasks" DROP CONSTRAINT "async_tasks_pkey",
DROP COLUMN "task_id",
ADD COLUMN     "task_id" SERIAL NOT NULL,
ADD CONSTRAINT "async_tasks_pkey" PRIMARY KEY ("task_id");

-- AlterTable
ALTER TABLE "public"."audit_log" DROP CONSTRAINT "audit_log_pkey",
DROP COLUMN "audit_log_id",
ADD COLUMN     "audit_log_id" SERIAL NOT NULL,
ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("audit_log_id");

-- AlterTable
ALTER TABLE "public"."cases" DROP CONSTRAINT "cases_pkey",
DROP COLUMN "case_id",
ADD COLUMN     "case_id" SERIAL NOT NULL,
DROP COLUMN "parent_id",
ADD COLUMN     "parent_id" INTEGER,
ADD CONSTRAINT "cases_pkey" PRIMARY KEY ("case_id");

-- AlterTable
ALTER TABLE "public"."comments" DROP CONSTRAINT "comments_pkey",
DROP COLUMN "comment_id",
ADD COLUMN     "comment_id" SERIAL NOT NULL,
DROP COLUMN "case_id",
ADD COLUMN     "case_id" INTEGER,
DROP COLUMN "task_id",
ADD COLUMN     "task_id" INTEGER,
ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("comment_id");

-- AlterTable
ALTER TABLE "public"."configuration_change_logs" DROP CONSTRAINT "configuration_change_logs_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "config_id",
ADD COLUMN     "config_id" INTEGER NOT NULL,
ADD CONSTRAINT "configuration_change_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."evidence" DROP CONSTRAINT "evidence_pkey",
DROP COLUMN "evidence_id",
ADD COLUMN     "evidence_id" SERIAL NOT NULL,
DROP COLUMN "task_id",
ADD COLUMN     "task_id" INTEGER NOT NULL,
ADD CONSTRAINT "evidence_pkey" PRIMARY KEY ("evidence_id");

-- AlterTable
ALTER TABLE "public"."integration_configs" DROP CONSTRAINT "integration_configs_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."notification_logs" DROP CONSTRAINT "notification_logs_pkey",
DROP COLUMN "notification_log_id",
ADD COLUMN     "notification_log_id" SERIAL NOT NULL,
DROP COLUMN "task_id",
ADD COLUMN     "task_id" INTEGER,
DROP COLUMN "case_id",
ADD COLUMN     "case_id" INTEGER,
ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("notification_log_id");

-- AlterTable
ALTER TABLE "public"."reports" DROP CONSTRAINT "reports_pkey",
DROP COLUMN "report_id",
ADD COLUMN     "report_id" SERIAL NOT NULL,
DROP COLUMN "task_id",
ADD COLUMN     "task_id" INTEGER NOT NULL,
ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("report_id");

-- AlterTable
ALTER TABLE "public"."role_permissions" DROP CONSTRAINT "role_permissions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."system_configurations" DROP CONSTRAINT "system_configurations_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."tasks" DROP CONSTRAINT "tasks_pkey",
DROP COLUMN "task_id",
ADD COLUMN     "task_id" SERIAL NOT NULL,
DROP COLUMN "case_id",
ADD COLUMN     "case_id" INTEGER NOT NULL,
DROP COLUMN "work_queue_id",
ADD COLUMN     "work_queue_id" INTEGER,
ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("task_id");

-- AlterTable
ALTER TABLE "public"."user_notification_preferences" DROP CONSTRAINT "user_notification_preferences_pkey",
DROP COLUMN "preference_id",
ADD COLUMN     "preference_id" SERIAL NOT NULL,
ADD CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("preference_id");

-- AlterTable
ALTER TABLE "public"."work_queue_assignment_rules" DROP CONSTRAINT "work_queue_assignment_rules_pkey",
DROP COLUMN "assignment_rule_id",
ADD COLUMN     "assignment_rule_id" SERIAL NOT NULL,
DROP COLUMN "work_queue_id",
ADD COLUMN     "work_queue_id" INTEGER NOT NULL,
ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000',
ADD CONSTRAINT "work_queue_assignment_rules_pkey" PRIMARY KEY ("assignment_rule_id");

-- AlterTable
ALTER TABLE "public"."work_queue_members" DROP COLUMN "work_queue_id",
ADD COLUMN     "work_queue_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."work_queue_roles" DROP CONSTRAINT "work_queue_roles_pkey",
DROP COLUMN "work_queue_role_id",
ADD COLUMN     "work_queue_role_id" SERIAL NOT NULL,
DROP COLUMN "work_queue_id",
ADD COLUMN     "work_queue_id" INTEGER NOT NULL,
ADD CONSTRAINT "work_queue_roles_pkey" PRIMARY KEY ("work_queue_role_id");

-- AlterTable
ALTER TABLE "public"."work_queue_task_types" DROP CONSTRAINT "work_queue_task_types_pkey",
DROP COLUMN "work_queue_task_type_id",
ADD COLUMN     "work_queue_task_type_id" SERIAL NOT NULL,
DROP COLUMN "work_queue_id",
ADD COLUMN     "work_queue_id" INTEGER NOT NULL,
ADD CONSTRAINT "work_queue_task_types_pkey" PRIMARY KEY ("work_queue_task_type_id");

-- AlterTable
ALTER TABLE "public"."work_queues" DROP CONSTRAINT "work_queues_pkey",
DROP COLUMN "work_queue_id",
ADD COLUMN     "work_queue_id" SERIAL NOT NULL,
ADD CONSTRAINT "work_queues_pkey" PRIMARY KEY ("work_queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_case_id_key" ON "public"."alerts"("case_id");

-- CreateIndex
CREATE INDEX "notification_logs_task_id_idx" ON "public"."notification_logs"("task_id");

-- CreateIndex
CREATE INDEX "notification_logs_case_id_idx" ON "public"."notification_logs"("case_id");

-- CreateIndex
CREATE INDEX "tasks_work_queue_id_idx" ON "public"."tasks"("work_queue_id");

-- CreateIndex
CREATE INDEX "work_queue_assignment_rules_work_queue_id_idx" ON "public"."work_queue_assignment_rules"("work_queue_id");

-- CreateIndex
CREATE INDEX "work_queue_members_work_queue_id_idx" ON "public"."work_queue_members"("work_queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_queue_members_work_queue_id_user_id_key" ON "public"."work_queue_members"("work_queue_id", "user_id");

-- CreateIndex
CREATE INDEX "work_queue_roles_work_queue_id_idx" ON "public"."work_queue_roles"("work_queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_queue_roles_work_queue_id_role_key" ON "public"."work_queue_roles"("work_queue_id", "role");

-- CreateIndex
CREATE INDEX "work_queue_task_types_work_queue_id_idx" ON "public"."work_queue_task_types"("work_queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_queue_task_types_work_queue_id_task_type_key" ON "public"."work_queue_task_types"("work_queue_id", "task_type");

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evidence" ADD CONSTRAINT "evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_roles" ADD CONSTRAINT "work_queue_roles_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_task_types" ADD CONSTRAINT "work_queue_task_types_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_assignment_rules" ADD CONSTRAINT "work_queue_assignment_rules_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_members" ADD CONSTRAINT "work_queue_members_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;
