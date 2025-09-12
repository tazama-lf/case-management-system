/*
  Warnings:

  - The values [DRAFT,PENDING_CASE_CREATION,READY_FOR_ASSIGNMENT,ASSIGNED,IN_PROGRESS,SUSPENDED,PENDING_FINAL_APPROVAL,REOPENED,PENDING_REOPENING_APPROVAL,ABANDONED,CLOSED] on the enum `CaseStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [LOW,MEDIUM,HIGH] on the enum `Priority` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `alert_status` on the `alerts` table. All the data in the column will be lost.
  - The `status` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[case_id]` on the table `alerts` will be added. If there are existing duplicate values, this will fail.
  - Made the column `case_id` on table `alerts` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('UNASSIGNED_01', 'ASSIGNED_10', 'IN_PROGRESS_20', 'COMPLETED_30', 'BLOCKED_21');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."CaseStatus_new" AS ENUM ('DRAFT_00', 'PENDING_CASE_CREATION_APPROVAL_01', 'READY_FOR_ASSIGNMENT_02', 'RETURNED_03', 'ASSIGNED_10', 'IN_PROGRESS_20', 'SUSPENDED_21', 'PENDING_FINAL_APPROVAL_22', 'PENDING_REOPENING_30', 'REOPENED_31', 'AUTOCLOSED_CONFIRMED_71', 'AUTOCLOSED_REFUTED_72', 'CLOSED_REFUTED_81', 'CLOSED_CONFIRMED_82', 'CLOSED_INCONCLUSIVE_83', 'ABANDONED_99');
ALTER TABLE "public"."cases" ALTER COLUMN "status" TYPE "public"."CaseStatus_new" USING ("status"::text::"public"."CaseStatus_new");
ALTER TYPE "public"."CaseStatus" RENAME TO "CaseStatus_old";
ALTER TYPE "public"."CaseStatus_new" RENAME TO "CaseStatus";
DROP TYPE "public"."CaseStatus_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."Priority_new" AS ENUM ('NEW', 'URGENT', 'CRITICAL', 'BREACH');
ALTER TABLE "public"."alerts" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "public"."alerts" ALTER COLUMN "priority" TYPE "public"."Priority_new" USING ("priority"::text::"public"."Priority_new");
ALTER TABLE "public"."cases" ALTER COLUMN "priority" TYPE "public"."Priority_new" USING ("priority"::text::"public"."Priority_new");
ALTER TYPE "public"."Priority" RENAME TO "Priority_old";
ALTER TYPE "public"."Priority_new" RENAME TO "Priority";
DROP TYPE "public"."Priority_old";
ALTER TABLE "public"."alerts" ALTER COLUMN "priority" SET DEFAULT 'NEW';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."alerts" DROP CONSTRAINT "alerts_case_id_fkey";

-- AlterTable
ALTER TABLE "public"."alerts" DROP COLUMN "alert_status",
ALTER COLUMN "priority" SET DEFAULT 'NEW',
ALTER COLUMN "case_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."cases" ALTER COLUMN "case_owner_user_id" DROP NOT NULL,
ALTER COLUMN "priority" SET DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "public"."tasks" DROP COLUMN "status",
ADD COLUMN     "status" "public"."TaskStatus" NOT NULL DEFAULT 'UNASSIGNED_01',
ALTER COLUMN "assigned_user_id" DROP NOT NULL;

-- DropEnum
DROP TYPE "public"."AlertStatus";

-- CreateIndex
CREATE UNIQUE INDEX "alerts_case_id_key" ON "public"."alerts"("case_id");

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;
